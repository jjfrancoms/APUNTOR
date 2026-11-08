import type { PgBoss } from 'pg-boss';
import { describe, expect, it } from 'vitest';
import type { ReprocessResult } from '../../api/src/admin';
import { createIngestionEnqueuer, IngestionAlreadyQueuedError } from '../../api/src/queue';
import { EMBEDDING_DIMENSIONS } from '../../db/schema';
import type { IngestionRepository } from '../../worker/src/ingestion/document-repository';
import { processDocument } from '../../worker/src/ingestion/queue-worker';
import {
  parseReprocessArgs,
  reprocessDocuments,
  type ReprocessStore,
} from '../../worker/src/ingestion/reprocess';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

function fakeStore(statuses: Record<string, string>) {
  const store: ReprocessStore = {
    listCompletedDocumentIds: () =>
      Promise.resolve(Object.keys(statuses).filter((id) => statuses[id] === 'completed')),
    reprocessCompletedDocument(id): Promise<ReprocessResult> {
      if (statuses[id] === undefined) return Promise.resolve('not_found');
      if (statuses[id] !== 'completed') return Promise.resolve('not_completed');
      statuses[id] = 'pending';
      return Promise.resolve('reprocessing');
    },
    restoreCompletedDocument(id) {
      statuses[id] = 'completed';
      return Promise.resolve();
    },
  };
  return store;
}

describe('argumentos de reprocesar', () => {
  it('acepta un id o --all-completed, y nada más', () => {
    expect(parseReprocessArgs([A])).toEqual({ all: false, documentId: A });
    expect(parseReprocessArgs(['--all-completed'])).toEqual({ all: true });
    expect(parseReprocessArgs([])).toBeNull();
    expect(parseReprocessArgs(['no-es-un-id'])).toBeNull();
    expect(parseReprocessArgs([A, B])).toBeNull();
  });
});

describe('reprocessDocuments', () => {
  it('marca y encola todos los completados, sin tocar los demás', async () => {
    const statuses = { [A]: 'completed', [B]: 'failed' };
    const enqueued: string[] = [];
    const outcome = await reprocessDocuments(
      { all: true },
      {
        store: fakeStore(statuses),
        enqueue: (id) => {
          enqueued.push(id);
          return Promise.resolve();
        },
      },
    );
    expect(outcome).toEqual({ enqueued: [A], skipped: [], failed: [] });
    expect(enqueued).toEqual([A]);
    expect(statuses).toEqual({ [A]: 'pending', [B]: 'failed' });
  });

  it('omite un documento que no está completado', async () => {
    const outcome = await reprocessDocuments(
      { all: false, documentId: B },
      { store: fakeStore({ [B]: 'processing' }), enqueue: () => Promise.resolve() },
    );
    expect(outcome.skipped).toEqual([B]);
  });

  it('si no se puede encolar, el documento vuelve a completado y sigue con el resto', async () => {
    const statuses = { [A]: 'completed', [B]: 'completed' };
    const outcome = await reprocessDocuments(
      { all: true },
      {
        store: fakeStore(statuses),
        enqueue: (id) => (id === A ? Promise.reject(new Error('cola caída')) : Promise.resolve()),
      },
    );
    expect(outcome).toEqual({ enqueued: [B], skipped: [], failed: [A] });
    expect(statuses).toEqual({ [A]: 'completed', [B]: 'pending' });
  });
});

describe('createIngestionEnqueuer', () => {
  const bossReturning = (jobId: string | null): PgBoss =>
    ({ send: () => Promise.resolve(jobId) }) as unknown as PgBoss;

  it('con requireNew avisa si la cola descartó el envío', async () => {
    await expect(
      createIngestionEnqueuer(bossReturning(null))(A, { requireNew: true }),
    ).rejects.toBeInstanceOf(IngestionAlreadyQueuedError);
  });

  it('sin requireNew un envío duplicado sigue siendo idempotente', async () => {
    await expect(createIngestionEnqueuer(bossReturning(null))(A)).resolves.toBeUndefined();
    await expect(
      createIngestionEnqueuer(bossReturning('job'))(A, { requireNew: true }),
    ).resolves.toBeUndefined();
  });
});

describe('el worker al reprocesar', () => {
  it('borra los resúmenes viejos antes de regenerar y reemplaza fragmentos y temas', async () => {
    const events: string[] = [];
    const repository: IngestionRepository = {
      getDocument: () =>
        Promise.resolve({ id: A, filePath: 'u/doc.pdf', status: 'pending' as const }),
      markProcessing: () => Promise.resolve(),
      deleteChunks: () => {
        events.push('deleteChunks');
        return Promise.resolve();
      },
      insertChunks: () => {
        events.push('insertChunks');
        return Promise.resolve();
      },
      replaceTopics: () => {
        events.push('replaceTopics');
        return Promise.resolve();
      },
      listTopics: () => Promise.resolve([]),
      markCompleted: () => {
        events.push('completed');
        return Promise.resolve();
      },
      markFailed: () => Promise.resolve(),
    };
    await processDocument(A, {
      repository,
      storage: {
        download: () => Promise.resolve(new Uint8Array([1])),
        sizeOf: () => Promise.resolve(1),
        delete: () => Promise.resolve(),
        createUploadUrl: () => Promise.resolve(''),
        upload: (key) => {
          events.push(`upload:${key}`);
          return Promise.resolve();
        },
        createDownloadUrl: () => Promise.resolve(''),
        deletePrefix: (prefix) => {
          events.push(`deletePrefix:${prefix}`);
          return Promise.resolve();
        },
      },
      extractor: {
        extractPages: () =>
          Promise.resolve({ totalPages: 1, pages: [{ pageNumber: 1, text: 'Texto nuevo' }] }),
      },
      embedder: {
        dimensions: EMBEDDING_DIMENSIONS,
        maxBatchSize: 10,
        embed: (texts) =>
          Promise.resolve(texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1))),
      },
      chunking: { maxTokens: 50, overlapTokens: 0 },
    });
    expect(events).toEqual([
      'deleteChunks',
      'deletePrefix:u/doc/summaries/',
      'insertChunks',
      'upload:u/doc/pages.json',
      'replaceTopics',
      'completed',
    ]);
  });
});
