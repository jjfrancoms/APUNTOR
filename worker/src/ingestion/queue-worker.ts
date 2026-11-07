import { isTransientAiError } from '../../../api/src/llm/retry';
import {
  assertEmbeddingDimensions,
  type EmbeddingProvider,
} from '../../../api/src/llm/embedding-provider';
import type { FileStorage } from '../../../api/src/storage/file-storage';
import { EMBEDDING_DIMENSIONS } from '../../../db/schema';
import { buildTopicTree, flattenTopicTree } from '../topics/topic-tree';
import type { EmbeddedChunk, IngestionRepository } from './document-repository';
import {
  chunkPages,
  DEFAULT_CHUNKING_OPTIONS,
  type ChunkingOptions,
  type DocumentExtractor,
  type TextChunk,
} from './pdf-parser';

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
  extractor: DocumentExtractor;
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

/** Errores que no mejoran reintentando (archivo sin texto, formato no admitido...). */
export class PermanentIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentIngestionError';
  }
}

const MAX_ERROR_MESSAGE_LENGTH = 300;
const DEFAULT_EMBEDDING_BATCH_SIZE = 64;

/**
 * Motivo que se guarda en `documents.error_message` (lo ve el panel de administrador). Nunca la
 * respuesta cruda del proveedor de IA: puede ser larga y traer datos de la cuenta de Google.
 */
export function toErrorMessage(error: unknown): string {
  if (isTransientAiError(error)) {
    return 'AI_RATE_LIMIT: la IA alcanzó su límite de uso; se puede reintentar más tarde.';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/^\s*[[{]/u.test(message)) return 'AI_ERROR: el proveedor de IA devolvió un error.';
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
 * (todo entra por `deps`), lo que permite testearlo sin cola ni Postgres.
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
    if (parsed.totalPages <= 0) throw new PermanentIngestionError('El documento no tiene páginas');

    const chunks = chunkPages(parsed.pages, deps.chunking ?? DEFAULT_CHUNKING_OPTIONS);
    if (chunks.length === 0) {
      throw new PermanentIngestionError(
        'No se encontró texto legible en el documento, ni siquiera con OCR',
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
