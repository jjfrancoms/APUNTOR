import { PGlite } from '@electric-sql/pglite';
import { PgBoss } from 'pg-boss';
import { describe, expect, it, vi } from 'vitest';
import {
  createIngestionEnqueuer,
  ensureIngestionQueue,
  INGESTION_QUEUE_NAME,
} from '../../api/src/queue';
import { handleIngestionJob } from '../../worker/src/ingestion/consumer';
import {
  PermanentIngestionError,
  processDocument,
  type IngestionDeps,
} from '../../worker/src/ingestion/queue-worker';

vi.mock('../../worker/src/ingestion/queue-worker', async (importOriginal) => {
  const original = await importOriginal<object>();
  return { ...original, processDocument: vi.fn() };
});

const DOC_ID = '00000000-0000-4000-8000-000000000001';
const deps = {} as IngestionDeps;
const job = (retryCount: number) => ({
  id: 'j1',
  data: { documentId: DOC_ID },
  retryCount,
  retryLimit: 2,
});

describe('handleIngestionJob', () => {
  it('solo el último intento marca el documento como fallido', async () => {
    const process = vi.mocked(processDocument);
    process.mockResolvedValue({
      documentId: DOC_ID,
      totalPages: 1,
      chunkCount: 1,
      topicCount: 0,
      skipped: false,
    });
    await handleIngestionJob(job(0), deps);
    expect(process.mock.lastCall?.[2]).toEqual({ markFailedOnError: false });
    await handleIngestionJob(job(2), deps);
    expect(process.mock.lastCall?.[2]).toEqual({ markFailedOnError: true });
  });

  it('relanza los errores transitorios para que la cola reintente', async () => {
    vi.mocked(processDocument).mockRejectedValue(new Error('503'));
    await expect(handleIngestionJob(job(0), deps)).rejects.toThrow('503');
  });

  it('no reintenta los errores permanentes', async () => {
    vi.mocked(processDocument).mockRejectedValue(new PermanentIngestionError('sin texto'));
    await expect(handleIngestionJob(job(0), deps)).resolves.toBeUndefined();
  });
});

describe('cola pg-boss sobre Postgres', () => {
  it('crea la cola dos veces sin error y no duplica un documento en cola', async () => {
    const pg = new PGlite();
    const boss = new PgBoss({
      db: {
        executeSql: async (text, values) => {
          if (values !== undefined && values.length > 0) {
            return pg.query(text, values);
          }
          const results = await pg.exec(text);
          return results.at(-1) as never;
        },
      },
      schedule: false,
      supervise: false,
    });
    boss.on('error', () => undefined);
    await boss.start();
    await ensureIngestionQueue(boss);
    await ensureIngestionQueue(boss);

    const enqueue = createIngestionEnqueuer(boss);
    await enqueue(DOC_ID);
    await enqueue(DOC_ID);
    await expect(enqueue('no-es-uuid')).rejects.toThrow('UUID');

    const jobs = await boss.fetch<{ documentId: string }>(INGESTION_QUEUE_NAME, { batchSize: 5 });
    expect(jobs.map((j) => j.data.documentId)).toEqual([DOC_ID]);
    await boss.stop({ graceful: false });
    await pg.close();
  }, 60_000);
});
