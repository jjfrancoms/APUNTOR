import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { waitlist, type WaitlistSource } from '../../db/schema';

export { WAITLIST_SOURCES, type WaitlistSource } from '../../db/schema';

/** Largo máximo de un correo (RFC 5321). */
export const MAX_WAITLIST_EMAIL = 254;

/** Forma única del correo en la tabla: lo que hace idempotente la inscripción. */
export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface WaitlistRecord {
  id: string;
  email: string;
  consent: boolean;
  source: WaitlistSource;
  createdAt: Date;
}

export interface WaitlistRepository {
  /** Idempotente: inscribirse otra vez no crea otra fila ni cambia la original. */
  join(entry: { email: string; consent: boolean; source: WaitlistSource }): Promise<void>;
  /** Las más recientes primero. */
  list(options: { limit: number; offset: number }): Promise<WaitlistRecord[]>;
  /** `false` si esa inscripción ya no existe. */
  remove(id: string): Promise<boolean>;
  findByEmail(email: string): Promise<WaitlistRecord | null>;
  removeByEmail(email: string): Promise<void>;
}

const waitlistColumns = {
  id: waitlist.id,
  email: waitlist.email,
  consent: waitlist.consent,
  source: waitlist.source,
  createdAt: waitlist.createdAt,
};

/** Solo el backend toca esta tabla (RLS sin políticas). */
export function createWaitlistRepository(db: Database): WaitlistRepository {
  return {
    async join({ email, consent, source }) {
      await db
        .insert(waitlist)
        .values({ email: normalizeWaitlistEmail(email), consent, source })
        .onConflictDoNothing({ target: waitlist.email });
    },
    list({ limit, offset }) {
      return db
        .select(waitlistColumns)
        .from(waitlist)
        .orderBy(desc(waitlist.createdAt), desc(waitlist.id))
        .limit(limit)
        .offset(offset);
    },
    async remove(id) {
      const removed = await db
        .delete(waitlist)
        .where(eq(waitlist.id, id))
        .returning({ id: waitlist.id });
      return removed.length > 0;
    },
    async findByEmail(email) {
      const rows = await db
        .select(waitlistColumns)
        .from(waitlist)
        .where(eq(waitlist.email, normalizeWaitlistEmail(email)))
        .limit(1);
      return rows[0] ?? null;
    },
    async removeByEmail(email) {
      await db.delete(waitlist).where(eq(waitlist.email, normalizeWaitlistEmail(email)));
    },
  };
}
