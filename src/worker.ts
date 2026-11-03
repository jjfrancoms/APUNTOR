import 'dotenv/config';
import { getServerEnv } from './config/env';
import { createDatabase } from './db/client';
import { DrizzleIngestionRepository } from './services/ingestion/document-repository';
import { UnpdfTextExtractor } from './services/ingestion/pdf-parser';
import { createIngestionWorker } from './services/ingestion/queue-worker';
import { createEmbeddingProvider } from './services/llm/create-embedding-provider';
import { SupabaseFileStorage } from './services/storage/file-storage';

/** Proceso independiente de Next.js: consume la cola de ingestión. */
function main(): void {
  const env = getServerEnv();
  const db = createDatabase(env.DATABASE_URL, { max: 5 });

  const worker = createIngestionWorker(
    { url: env.REDIS_URL, maxRetriesPerRequest: null },
    {
      repository: new DrizzleIngestionRepository(db),
      storage: new SupabaseFileStorage(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        env.SUPABASE_STORAGE_BUCKET,
      ),
      extractor: new UnpdfTextExtractor(),
      embedder: createEmbeddingProvider(env),
    },
  );

  worker.on('completed', (job, result) => {
    console.info(
      `[ingestion] ${job.id ?? '?'} ok: ${result.chunkCount} chunks / ${result.totalPages} págs.`,
    );
  });
  worker.on('failed', (job, error) => {
    console.error(
      `[ingestion] ${job?.id ?? '?'} falló (intento ${job?.attemptsMade ?? 0}): ${error.message}`,
    );
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

try {
  main();
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
