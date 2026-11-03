import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSIONS } from '../src/db/schema';
import type {
  EmbeddedChunk,
  IngestionDocument,
  IngestionRepository,
} from '../src/services/ingestion/document-repository';
import type { ParsedDocument, PdfTextExtractor } from '../src/services/ingestion/pdf-parser';
import {
  batches,
  PermanentIngestionError,
  processDocument,
  type IngestionDeps,
} from '../src/services/ingestion/queue-worker';
import type { EmbeddingProvider } from '../src/services/llm/embedding-provider';
import type { FlatTopic } from '../src/services/topics/topic-tree';

const DOC_ID = '00000000-0000-4000-8000-000000000001';

class InMemoryRepository implements IngestionRepository {
  chunks: EmbeddedChunk[] = [];
  topics: FlatTopic[] = [];
  events: string[] = [];
  constructor(public doc: IngestionDocument | null) {}
  getDocument(): Promise<IngestionDocument | null> {
    return Promise.resolve(this.doc);
  }
  markProcessing(): Promise<void> {
    this.events.push('processing');
    return Promise.resolve();
  }
  deleteChunks(): Promise<void> {
    this.chunks = [];
    return Promise.resolve();
  }
  insertChunks(chunks: readonly EmbeddedChunk[]): Promise<void> {
    this.events.push(`insert:${chunks.length}`);
    this.chunks.push(...chunks);
    return Promise.resolve();
  }
  replaceTopics(_id: string, topics: readonly FlatTopic[]): Promise<void> {
    this.events.push(`topics:${topics.length}`);
    this.topics = [...topics];
    return Promise.resolve();
  }
  markCompleted(_id: string, totalPages: number): Promise<void> {
    this.events.push(`completed:${totalPages}`);
    return Promise.resolve();
  }
  markFailed(_id: string, message: string): Promise<void> {
    this.events.push(`failed:${message}`);
    return Promise.resolve();
  }
}

class FakeEmbedder implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS;
  readonly maxBatchSize = 100;
  calls: number[] = [];
  embed(texts: readonly string[]): Promise<number[][]> {
    this.calls.push(texts.length);
    return Promise.resolve(
      texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1)),
    );
  }
}

function makeDeps(
  parsed: ParsedDocument,
  repo: InMemoryRepository,
  embedder = new FakeEmbedder(),
): IngestionDeps {
  const extractor: PdfTextExtractor = { extractPages: () => Promise.resolve(parsed) };
  return {
    repository: repo,
    storage: { download: () => Promise.resolve(new Uint8Array([1])) },
    extractor,
    embedder,
    chunking: { maxTokens: 50, overlapTokens: 10 },
    embeddingBatchSize: 16,
  };
}

const pendingDoc: IngestionDocument = { id: DOC_ID, filePath: 'u/doc.pdf', status: 'pending' };

describe('processDocument', () => {
  it('procesa un documento de 150 páginas con embeddings por lotes', async () => {
    const pages = Array.from({ length: 150 }, (_, i) => ({
      pageNumber: i + 1,
      text: `Contenido de la página ${i + 1}. `.repeat(10),
    }));
    const repo = new InMemoryRepository(pendingDoc);
    const embedder = new FakeEmbedder();
    const result = await processDocument(
      DOC_ID,
      makeDeps({ totalPages: 150, pages }, repo, embedder),
    );

    expect(result.totalPages).toBe(150);
    expect(result.chunkCount).toBe(repo.chunks.length);
    expect(Math.max(...embedder.calls)).toBeLessThanOrEqual(16);
    expect(embedder.calls.length).toBe(Math.ceil(repo.chunks.length / 16));
    expect(repo.events[0]).toBe('processing');
    expect(repo.events.at(-1)).toBe('completed:150');
    expect(new Set(repo.chunks.map((c) => c.pageNumber)).size).toBe(150);
    expect(repo.chunks.every((c) => c.documentId === DOC_ID)).toBe(true);
  });

  it('guarda el árbol de temas detectado antes de marcar completed', async () => {
    const pages = [
      { pageNumber: 1, text: '1. La célula\nLa célula es la unidad básica de la vida.' },
      { pageNumber: 2, text: '1.1 Mitocondria\nProduce ATP.' },
      { pageNumber: 3, text: '2. Genética\nEl ADN guarda información.' },
    ];
    const repo = new InMemoryRepository(pendingDoc);
    const result = await processDocument(DOC_ID, makeDeps({ totalPages: 3, pages }, repo));

    expect(result.topicCount).toBe(3);
    expect(repo.topics).toEqual([
      { parentIndex: null, title: '1. La célula', level: 1, sourcePages: [1, 2] },
      { parentIndex: 0, title: '1.1 Mitocondria', level: 2, sourcePages: [2] },
      { parentIndex: null, title: '2. Genética', level: 1, sourcePages: [3] },
    ]);
    expect(repo.events.slice(-2)).toEqual(['topics:3', 'completed:3']);
  });

  it('marca failed si el PDF no tiene texto extraíble', async () => {
    const repo = new InMemoryRepository(pendingDoc);
    const deps = makeDeps({ totalPages: 3, pages: [{ pageNumber: 1, text: '' }] }, repo);
    await expect(
      processDocument(DOC_ID, deps, { markFailedOnError: false }),
    ).rejects.toBeInstanceOf(PermanentIngestionError);
    expect(repo.events.at(-1)).toMatch(/^failed:/u);
  });

  it('no marca failed en errores transitorios si quedan reintentos', async () => {
    const repo = new InMemoryRepository(pendingDoc);
    const deps = makeDeps({ totalPages: 1, pages: [{ pageNumber: 1, text: 'hola mundo' }] }, repo);
    deps.embedder = {
      dimensions: EMBEDDING_DIMENSIONS,
      maxBatchSize: 100,
      embed: () => Promise.reject(new Error('503')),
    };
    await expect(processDocument(DOC_ID, deps, { markFailedOnError: false })).rejects.toThrow(
      '503',
    );
    expect(repo.events.some((e) => e.startsWith('failed'))).toBe(false);
  });

  it('omite documentos ya completados (idempotencia)', async () => {
    const repo = new InMemoryRepository({ ...pendingDoc, status: 'completed' });
    const result = await processDocument(DOC_ID, makeDeps({ totalPages: 1, pages: [] }, repo));
    expect(result.skipped).toBe(true);
    expect(repo.events).toEqual([]);
  });
});

describe('batches', () => {
  it('divide en lotes del tamaño pedido', () => {
    expect([...batches([1, 2, 3, 4, 5], 2)]).toEqual([[1, 2], [3, 4], [5]]);
  });
});
