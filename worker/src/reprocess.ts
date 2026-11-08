import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createAdminRepository } from '../../api/src/admin';
import { getServerEnv } from '../../api/src/config/env';
import {
  createIngestionEnqueuer,
  createQueueClient,
  ensureIngestionQueue,
} from '../../api/src/queue';
import { createDatabase } from '../../db/client';
import { documents } from '../../db/schema';
import { parseReprocessArgs, reprocessDocuments, REPROCESS_USAGE } from './ingestion/reprocess';

/** `npm run reprocess -- <documentId> | --all-completed`: marca y encola; lo procesa el worker. */
async function main(): Promise<number> {
  const target = parseReprocessArgs(process.argv.slice(2));
  if (target === null) {
    console.error(REPROCESS_USAGE);
    return 2;
  }

  const env = getServerEnv();
  const db = createDatabase(env.DATABASE_URL, { max: 2 });
  const admin = createAdminRepository(db);
  const boss = createQueueClient(env.QUEUE_DATABASE_URL);
  boss.on('error', (error) => {
    console.error('[cola]', error);
  });
  await boss.start();
  try {
    await ensureIngestionQueue(boss);
    const outcome = await reprocessDocuments(target, {
      store: {
        listCompletedDocumentIds: async () =>
          (
            await db
              .select({ id: documents.id })
              .from(documents)
              .where(eq(documents.status, 'completed'))
          ).map((row) => row.id),
        reprocessCompletedDocument: (id) => admin.reprocessCompletedDocument(id),
        restoreCompletedDocument: (id) => admin.restoreCompletedDocument(id),
      },
      enqueue: createIngestionEnqueuer(boss),
    });
    console.info(
      `[reprocesar] encolados: ${outcome.enqueued.length}, omitidos: ${outcome.skipped.length}, ` +
        `fallidos: ${outcome.failed.length}`,
    );
    for (const id of outcome.skipped) console.warn(`[reprocesar] omitido (no completado): ${id}`);
    for (const id of outcome.failed) console.error(`[reprocesar] no se pudo encolar: ${id}`);
    return outcome.failed.length > 0 || (!target.all && outcome.enqueued.length === 0) ? 1 : 0;
  } finally {
    await boss.stop();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
