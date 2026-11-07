import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { consents, type ConsentDocument } from '../../db/schema';

export { CONSENT_DOCUMENTS, type ConsentDocument } from '../../db/schema';

/** Largo máximo de la versión de un documento legal (p. ej. `2026-11-01`). */
export const MAX_CONSENT_VERSION = 32;

export interface ConsentRecord {
  document: ConsentDocument;
  version: string;
  acceptedAt: Date;
}

export interface ConsentsRepository {
  /**
   * Registra la aceptación. Es idempotente: aceptar otra vez la misma versión no crea otra fila
   * y devuelve la fecha de la primera aceptación.
   */
  accept(userId: string, document: ConsentDocument, version: string): Promise<ConsentRecord>;
  list(userId: string): Promise<ConsentRecord[]>;
}

const consentColumns = {
  document: consents.document,
  version: consents.version,
  acceptedAt: consents.acceptedAt,
};

/** Toda consulta filtra por usuario, además de RLS. El borrado va en `deleteAllForUser`. */
export function createConsentsRepository(db: Database): ConsentsRepository {
  return {
    async accept(userId, document, version) {
      const inserted = await db
        .insert(consents)
        .values({ userId, document, version })
        .onConflictDoNothing({ target: [consents.userId, consents.document, consents.version] })
        .returning(consentColumns);
      const row =
        inserted[0] ??
        (
          await db
            .select(consentColumns)
            .from(consents)
            .where(
              and(
                eq(consents.userId, userId),
                eq(consents.document, document),
                eq(consents.version, version),
              ),
            )
            .limit(1)
        )[0];
      if (!row) throw new Error('No se pudo registrar el consentimiento');
      return row;
    },
    list(userId) {
      return db
        .select(consentColumns)
        .from(consents)
        .where(eq(consents.userId, userId))
        .orderBy(asc(consents.acceptedAt), asc(consents.document));
    },
  };
}
