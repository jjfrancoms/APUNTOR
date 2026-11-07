import { createDatabase, type Database } from '../../db/client';
import { EMBEDDING_DIMENSIONS } from '../../db/schema';
import type { ServerEnv } from './config/env';
import {
  chooseGenAiBackend,
  createGenAiModels,
  VertexEmbeddingProvider,
  VertexGenerator,
} from './llm/vertex';
import { createChunkSearch } from './rag/retriever';
import { R2FileStorage } from './storage/file-storage';

/** Piezas reales que comparten la API, el worker y el arnés de evaluación. */
export function createInfrastructure(env: ServerEnv, options: { maxConnections?: number } = {}) {
  const db: Database = createDatabase(
    env.DATABASE_URL,
    options.maxConnections === undefined ? {} : { max: options.maxConnections },
  );
  const models = createGenAiModels(chooseGenAiBackend(env));
  return {
    db,
    models,
    embedder: new VertexEmbeddingProvider(models, EMBEDDING_DIMENSIONS),
    generator: new VertexGenerator(models),
    search: createChunkSearch(db),
    storage: new R2FileStorage(
      env.R2_ACCOUNT_ID,
      env.R2_ACCESS_KEY_ID,
      env.R2_SECRET_ACCESS_KEY,
      env.R2_BUCKET,
    ),
  };
}
