import 'dotenv/config';
import { createSupabaseUserDeleter } from './account';
import { createAdminRepository, createSupabaseUsersDirectory, parseAdminEmails } from './admin';
import { createTopicSummarizer } from './topic-summary';
import { buildApp } from './app';
import { createSupabaseAuthenticator } from './auth';
import { getServerEnv } from './config/env';
import { createConsentsRepository } from './consents';
import { createConversationsRepository } from './conversations';
import { createDocumentsRepository } from './documents';
import { createTavilySearch } from './external/tavily';
import { createIngestionEnqueuer, createQueueClient, ensureIngestionQueue } from './queue';
import { createQuotaService } from './quota';
import { createInfrastructure } from './wiring';

async function main(): Promise<void> {
  const env = getServerEnv();
  const { db, models, modelChoice, embedder, generator, fallbackGenerator, search, storage } =
    createInfrastructure(env);

  const boss = createQueueClient(env.QUEUE_DATABASE_URL);
  boss.on('error', (error) => {
    console.error('[cola]', error);
  });
  await boss.start();
  await ensureIngestionQueue(boss);

  const app = await buildApp({
    authenticate: createSupabaseAuthenticator(env.SUPABASE_URL),
    documents: createDocumentsRepository(db),
    consents: createConsentsRepository(db),
    conversations: createConversationsRepository(db),
    storage,
    enqueue: createIngestionEnqueuer(boss),
    quota: createQuotaService(db),
    answer: { embedder, search, generator, ...(fallbackGenerator ? { fallbackGenerator } : {}) },
    summaries: createTopicSummarizer({
      models,
      model: modelChoice.summary,
      storage,
    }),
    deleteAuthUser: createSupabaseUserDeleter(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
    admin: createAdminRepository(db),
    authUsers: createSupabaseUsersDirectory(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
    adminEmails: parseAdminEmails(env.ADMIN_EMAILS),
    ...(env.TAVILY_API_KEY === undefined
      ? {}
      : { externalSearch: createTavilySearch(env.TAVILY_API_KEY) }),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    logger: true,
    // Railway pone un proxy delante: sin esto, todas las peticiones tendrían la misma IP.
    // Solo se confía en ese salto, para que X-Forwarded-For inventado no cambie la IP.
    trustProxy: 1,
  });

  const shutdown = async (): Promise<void> => {
    await app.close();
    await boss.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
