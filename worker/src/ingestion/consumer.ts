import type { PgBoss } from 'pg-boss';
import { INGESTION_QUEUE_NAME, type IngestionJobData } from '../../../api/src/queue';
import {
  DocumentNotFoundError,
  PermanentIngestionError,
  processDocument,
  type IngestionDeps,
} from './queue-worker';

export interface IngestionJob {
  id: string;
  data: IngestionJobData;
  retryCount: number;
  retryLimit: number;
}

/**
 * Un error permanente (ya marcado como `failed`) termina el trabajo sin reintentos. Uno
 * transitorio se relanza para que pg-boss reintente, y solo el último intento marca `failed`.
 */
export async function handleIngestionJob(job: IngestionJob, deps: IngestionDeps): Promise<void> {
  try {
    const result = await processDocument(job.data.documentId, deps, {
      markFailedOnError: job.retryCount >= job.retryLimit,
    });
    console.info(
      `[ingesta] ${job.id} ok: ${result.chunkCount} fragmentos / ${result.totalPages} págs.`,
    );
  } catch (error) {
    if (error instanceof DocumentNotFoundError || error instanceof PermanentIngestionError) {
      console.error(`[ingesta] ${job.id} descartado: ${error.message}`);
      return;
    }
    console.error(`[ingesta] ${job.id} falló (reintentos: ${job.retryCount})`);
    throw error;
  }
}

export async function startIngestionConsumer(
  boss: PgBoss,
  deps: IngestionDeps,
  options: { concurrency?: number } = {},
): Promise<void> {
  await boss.work<
    IngestionJobData,
    unknown,
    { includeMetadata: true; batchSize: 1; localConcurrency: number }
  >(
    INGESTION_QUEUE_NAME,
    {
      includeMetadata: true,
      batchSize: 1,
      // Pocos documentos a la vez: cada uno ya hace muchas llamadas de embeddings y OCR.
      localConcurrency: options.concurrency ?? 2,
    },
    async (jobs) => {
      for (const job of jobs) await handleIngestionJob(job, deps);
    },
  );
}
