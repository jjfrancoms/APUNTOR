import { createDatabase, type Database } from '../../db/client';
import { EMBEDDING_DIMENSIONS } from '../../db/schema';
import type { ServerEnv } from './config/env';
import {
  chooseGenAiBackend,
  createGenAiModels,
  VertexEmbeddingProvider,
  VertexGenerator,
} from './llm/vertex';
import { HIGH_THINKING_BUDGET, MEDIUM_THINKING_BUDGET, resolveModels } from './llm/models';
import { REQUEST_AI_RETRY, withRetries, type RetryPolicy } from './llm/retry';
import { createChunkSearch } from './rag/retriever';
import { R2FileStorage } from './storage/file-storage';

/** Piezas reales que comparten la API, el worker y el arnés de evaluación. */
export function createInfrastructure(
  env: ServerEnv,
  options: { maxConnections?: number; aiRetry?: RetryPolicy } = {},
) {
  const db: Database = createDatabase(
    env.DATABASE_URL,
    options.maxConnections === undefined ? {} : { max: options.maxConnections },
  );
  const models = withRetries(
    createGenAiModels(chooseGenAiBackend(env)),
    options.aiRetry ?? REQUEST_AI_RETRY,
  );
  const modelChoice = resolveModels(env);
  return {
    db,
    models,
    modelChoice,
    embedder: new VertexEmbeddingProvider(models, EMBEDDING_DIMENSIONS),
    /** Chat con el modelo medio. */
    generator: new VertexGenerator(models, modelChoice.chat, MEDIUM_THINKING_BUDGET),
    /** Segundo intento del chat con el modelo alto (solo si es otro modelo). */
    fallbackGenerator:
      modelChoice.high === modelChoice.chat
        ? undefined
        : new VertexGenerator(models, modelChoice.high, HIGH_THINKING_BUDGET),
    /** Generación de quizzes y tarjetas con el modelo alto: se hace una vez y se guarda. */
    strongGenerator: new VertexGenerator(models, modelChoice.high, HIGH_THINKING_BUDGET),
    search: createChunkSearch(db),
    storage: new R2FileStorage(
      env.R2_ACCOUNT_ID,
      env.R2_ACCESS_KEY_ID,
      env.R2_SECRET_ACCESS_KEY,
      env.R2_BUCKET,
    ),
  };
}
