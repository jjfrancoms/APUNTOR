import 'dotenv/config';
import { getServerEnv } from '../../api/src/config/env';
import { WORKER_AI_RETRY } from '../../api/src/llm/retry';
import { VertexOcrProvider } from '../../api/src/llm/vertex';
import { createQueueClient, ensureIngestionQueue } from '../../api/src/queue';
import { createTopicSummarizer } from '../../api/src/topic-summary';
import { createInfrastructure } from '../../api/src/wiring';
import { startIngestionConsumer } from './ingestion/consumer';
import { DrizzleIngestionRepository } from './ingestion/document-repository';
import { MultiFormatExtractor } from './ingestion/extractors';
import { PdfPageRenderer } from './ingestion/page-artifacts';
import { createSummaryPregenerator } from './ingestion/topic-summaries';

/** Proceso independiente de la API: consume la cola de ingesta. */
async function main(): Promise<void> {
  const env = getServerEnv();
  const { db, models, modelChoice, embedder, storage } = createInfrastructure(env, {
    maxConnections: 5,
    aiRetry: WORKER_AI_RETRY,
  });

  const boss = createQueueClient(env.QUEUE_DATABASE_URL);
  boss.on('error', (error) => {
    console.error('[cola]', error);
  });
  await boss.start();
  await ensureIngestionQueue(boss);

  await startIngestionConsumer(boss, {
    repository: new DrizzleIngestionRepository(db),
    storage,
    extractor: new MultiFormatExtractor(new VertexOcrProvider(models, modelChoice.ocr)),
    embedder,
    pageRenderer: new PdfPageRenderer(),
    // Resúmenes de tema con el modelo alto, tras completar la ingesta (mismo caché que la API).
    summaries: createSummaryPregenerator({
      summarizer: createTopicSummarizer({ models, model: modelChoice.summary, storage }),
      storage,
    }),
  });

  const shutdown = async (): Promise<void> => {
    await boss.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
