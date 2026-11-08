import { PgBoss } from 'pg-boss';

export const INGESTION_QUEUE_NAME = 'document-ingestion';

export interface IngestionJobData {
  documentId: string;
}

/** `requireNew`: falla si la cola descarta el envío porque ya hay un trabajo de ese documento. */
export type IngestionEnqueuer = (
  documentId: string,
  options?: { requireNew?: boolean },
) => Promise<void>;

/**
 * El documento ya tiene un trabajo en cola o activo (p. ej. aún generando sus resúmenes tras
 * `completed`): pg-boss descarta el envío y, sin avisar, el documento quedaría en `pending`.
 */
export class IngestionAlreadyQueuedError extends Error {
  constructor(documentId: string) {
    super(`El documento ${documentId} ya tiene un trabajo en la cola`);
    this.name = 'IngestionAlreadyQueuedError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function createQueueClient(connectionString: string): PgBoss {
  return new PgBoss({ connectionString, schema: 'pgboss' });
}

/** Llamar tras `start()`, en la API y en el worker: `createQueue` admite repetirse. */
export async function ensureIngestionQueue(boss: PgBoss): Promise<void> {
  await boss.createQueue(INGESTION_QUEUE_NAME, {
    // `exclusive` + singletonKey: un documento no puede estar en cola ni activo dos veces.
    policy: 'exclusive',
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    // Con OCR, un documento grande puede tardar bastante.
    expireInSeconds: 30 * 60,
  });
}

/** Encola y retorna de inmediato: la petición HTTP nunca espera a la ingesta. */
export function createIngestionEnqueuer(boss: PgBoss): IngestionEnqueuer {
  return async (documentId, options = {}) => {
    if (!UUID_RE.test(documentId)) throw new Error('documentId debe ser un UUID');
    const data: IngestionJobData = { documentId };
    const jobId = await boss.send(INGESTION_QUEUE_NAME, data, { singletonKey: documentId });
    if (jobId === null && options.requireNew === true) {
      throw new IngestionAlreadyQueuedError(documentId);
    }
  };
}
