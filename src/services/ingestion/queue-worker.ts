import { Queue, UnrecoverableError, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { EMBEDDING_DIMENSIONS } from '../../db/schema';
import { assertEmbeddingDimensions, type EmbeddingProvider } from '../llm/embedding-provider';
import type { FileStorage } from '../storage/file-storage';
import { buildTopicTree, flattenTopicTree } from '../topics/topic-tree';
import type { EmbeddedChunk, IngestionRepository } from './document-repository';
import {
  chunkPages,
  DEFAULT_CHUNKING_OPTIONS,
  type ChunkingOptions,
  type PdfTextExtractor,
  type TextChunk,
} from './pdf-parser';

export const INGESTION_QUEUE_NAME = 'document-ingestion';

export interface IngestionJobData {
  documentId: string;
}

export interface IngestionJobResult {
  documentId: string;
  totalPages: number;
  chunkCount: number;
  topicCount: number;
  skipped: boolean;
}

export interface IngestionProgress {
  stage: 'parsing' | 'embedding' | 'topics' | 'done';
  processedChunks: number;
  totalChunks: number;
}

export interface IngestionDeps {
  repository: IngestionRepository;
  storage: FileStorage;
  extractor: PdfTextExtractor;
  embedder: EmbeddingProvider;
  chunking?: ChunkingOptions;
  /** Chunks por llamada de embeddings (se limita a `embedder.maxBatchSize`). */
  embeddingBatchSize?: number;
}

export class DocumentNotFoundError extends Error {
  constructor(documentId: string) {
    super(`Documento ${documentId} no encontrado`);
    this.name = 'DocumentNotFoundError';
  }
}

/** Errores que no mejoran reintentando (PDF sin texto, documento borrado...). */
export class PermanentIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentIngestionError';
  }
}

const MAX_ERROR_MESSAGE_LENGTH = 1000;
const DEFAULT_EMBEDDING_BATCH_SIZE = 64;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function toErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

export function* batches<T>(items: readonly T[], size: number): Generator<T[]> {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError('size debe ser > 0');
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

function toEmbeddedChunk(documentId: string, chunk: TextChunk, embedding: number[]): EmbeddedChunk {
  return {
    documentId,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    tokenCount: chunk.tokenCount,
    sectionTitle: chunk.sectionTitle,
    metadata: {
      sectionPath: chunk.sectionPath,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
    },
    embedding,
  };
}

/**
 * Pipeline completo de un documento. Es puro respecto a la infraestructura
 * (todo entra por `deps`), lo que permite testearlo sin Redis ni Postgres.
 *
 * Idempotente: borra los chunks previos antes de insertar, de modo que un
 * reintento tras un fallo parcial no deja duplicados.
 */
export async function processDocument(
  documentId: string,
  deps: IngestionDeps,
  options: {
    markFailedOnError?: boolean;
    onProgress?: (progress: IngestionProgress) => Promise<void> | void;
  } = {},
): Promise<IngestionJobResult> {
  const { repository, storage, extractor, embedder } = deps;
  const markFailedOnError = options.markFailedOnError ?? true;
  const onProgress = options.onProgress ?? ((): void => undefined);

  if (embedder.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new PermanentIngestionError(
      `El proveedor genera ${embedder.dimensions} dims y el esquema espera ${EMBEDDING_DIMENSIONS}`,
    );
  }

  const document = await repository.getDocument(documentId);
  if (!document) throw new DocumentNotFoundError(documentId);
  if (document.status === 'completed') {
    return { documentId, totalPages: 0, chunkCount: 0, topicCount: 0, skipped: true };
  }

  try {
    await repository.markProcessing(documentId);
    await onProgress({ stage: 'parsing', processedChunks: 0, totalChunks: 0 });

    const bytes = await storage.download(document.filePath);
    const parsed = await extractor.extractPages(bytes);
    if (parsed.totalPages <= 0) throw new PermanentIngestionError('El PDF no tiene páginas');

    const chunks = chunkPages(parsed.pages, deps.chunking ?? DEFAULT_CHUNKING_OPTIONS);
    if (chunks.length === 0) {
      throw new PermanentIngestionError(
        'No se extrajo texto del PDF (¿documento escaneado? requiere OCR)',
      );
    }

    await repository.deleteChunks(documentId);

    const batchSize = Math.min(
      deps.embeddingBatchSize ?? DEFAULT_EMBEDDING_BATCH_SIZE,
      embedder.maxBatchSize,
    );
    let processed = 0;
    for (const batch of batches(chunks, batchSize)) {
      const vectors = await embedder.embed(
        batch.map((c) => c.content),
        'document',
      );
      if (vectors.length !== batch.length) {
        throw new Error(
          `El proveedor devolvió ${vectors.length} embeddings para ${batch.length} textos`,
        );
      }
      assertEmbeddingDimensions(vectors, EMBEDDING_DIMENSIONS);
      await repository.insertChunks(
        batch.map((chunk, i) => toEmbeddedChunk(documentId, chunk, vectors[i] ?? [])),
      );
      processed += batch.length;
      await onProgress({
        stage: 'embedding',
        processedChunks: processed,
        totalChunks: chunks.length,
      });
    }

    await onProgress({ stage: 'topics', processedChunks: processed, totalChunks: chunks.length });
    const topicRows = flattenTopicTree(buildTopicTree(chunks));
    await repository.replaceTopics(documentId, topicRows);

    await repository.markCompleted(documentId, parsed.totalPages);
    await onProgress({ stage: 'done', processedChunks: processed, totalChunks: chunks.length });
    return {
      documentId,
      totalPages: parsed.totalPages,
      chunkCount: chunks.length,
      topicCount: topicRows.length,
      skipped: false,
    };
  } catch (error) {
    if (markFailedOnError || error instanceof PermanentIngestionError) {
      await repository.markFailed(documentId, toErrorMessage(error));
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Productor
// ---------------------------------------------------------------------------

export function createIngestionQueue(
  connection: ConnectionOptions,
): Queue<IngestionJobData, IngestionJobResult> {
  return new Queue<IngestionJobData, IngestionJobResult>(INGESTION_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
}

/**
 * Encola un documento ya registrado con estado `pending`. Retorna de inmediato:
 * la petición HTTP nunca espera al parseo ni a los embeddings.
 * El `jobId` = `documentId` evita encolar dos veces el mismo documento.
 */
export async function enqueueDocumentIngestion(
  queue: Queue<IngestionJobData, IngestionJobResult>,
  documentId: string,
): Promise<string> {
  if (!UUID_RE.test(documentId)) throw new Error('documentId debe ser un UUID');
  const job = await queue.add('ingest-document', { documentId }, { jobId: documentId });
  return job.id ?? documentId;
}

// ---------------------------------------------------------------------------
// Consumidor
// ---------------------------------------------------------------------------

export function createIngestionWorker(
  connection: ConnectionOptions,
  deps: IngestionDeps,
  options: { concurrency?: number } = {},
): Worker<IngestionJobData, IngestionJobResult> {
  return new Worker<IngestionJobData, IngestionJobResult>(
    INGESTION_QUEUE_NAME,
    async (job: Job<IngestionJobData, IngestionJobResult>) => {
      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      try {
        return await processDocument(job.data.documentId, deps, {
          markFailedOnError: isFinalAttempt,
          onProgress: (progress) => job.updateProgress({ ...progress }),
        });
      } catch (error) {
        if (error instanceof DocumentNotFoundError || error instanceof PermanentIngestionError) {
          throw new UnrecoverableError(error.message);
        }
        throw error;
      }
    },
    {
      connection,
      // Documentos de 100+ páginas: pocos en paralelo, cada uno con embeddings por lotes.
      concurrency: options.concurrency ?? 2,
      lockDuration: 5 * 60_000,
    },
  );
}
