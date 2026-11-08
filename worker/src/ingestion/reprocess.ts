import type { ReprocessResult } from '../../../api/src/admin';
import type { IngestionEnqueuer } from '../../../api/src/queue';

/** Lo que pide la línea de comandos: un documento o todos los completados. */
export type ReprocessTarget = { all: true } | { all: false; documentId: string };

export const REPROCESS_USAGE = 'Uso: npm run reprocess -- <documentId> | --all-completed';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Devuelve null si los argumentos no son exactamente un id o `--all-completed`. */
export function parseReprocessArgs(args: readonly string[]): ReprocessTarget | null {
  const [arg, ...rest] = args;
  if (arg === undefined || rest.length > 0) return null;
  if (arg === '--all-completed') return { all: true };
  return UUID_RE.test(arg) ? { all: false, documentId: arg } : null;
}

export interface ReprocessStore {
  listCompletedDocumentIds(): Promise<string[]>;
  reprocessCompletedDocument(documentId: string): Promise<ReprocessResult>;
  restoreCompletedDocument(documentId: string): Promise<void>;
}

export interface ReprocessOutcome {
  enqueued: string[];
  /** No estaban completados o no existen: no se tocaron. */
  skipped: string[];
  /** No se pudieron encolar: volvieron a `completed`. */
  failed: string[];
}

/** Uno por uno: un fallo al encolar deja ese documento como estaba y sigue con el resto. */
export async function reprocessDocuments(
  target: ReprocessTarget,
  deps: { store: ReprocessStore; enqueue: IngestionEnqueuer },
): Promise<ReprocessOutcome> {
  const ids = target.all ? await deps.store.listCompletedDocumentIds() : [target.documentId];
  const outcome: ReprocessOutcome = { enqueued: [], skipped: [], failed: [] };
  for (const id of ids) {
    if ((await deps.store.reprocessCompletedDocument(id)) !== 'reprocessing') {
      outcome.skipped.push(id);
      continue;
    }
    try {
      await deps.enqueue(id, { requireNew: true });
      outcome.enqueued.push(id);
    } catch {
      await deps.store.restoreCompletedDocument(id);
      outcome.failed.push(id);
    }
  }
  return outcome;
}
