import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/client';

export type QuotaKind = 'questions' | 'storage_bytes' | 'summaries' | 'study_generations';

/** Plan gratis de docs/producto/mvp-ux.md, marcadas allí como cifras de ejemplo. */
export const FREE_LIMITS: Record<QuotaKind, number> = {
  questions: 20,
  summaries: 30,
  storage_bytes: 500 * 1024 * 1024,
  study_generations: 10,
};

/** El espacio no se reinicia: se acumula siempre en el mismo periodo. */
const ACCUMULATED_PERIOD = '1970-01-01';
const QUOTA_TIME_ZONE = 'America/Lima';

/** Lo diario (preguntas, resúmenes y generaciones de estudio) se reinicia a medianoche en Perú; `en-CA` da el formato AAAA-MM-DD. */
export function periodFor(kind: QuotaKind, now: Date = new Date()): string {
  if (kind === 'storage_bytes') return ACCUMULATED_PERIOD;
  return now.toLocaleDateString('en-CA', { timeZone: QUOTA_TIME_ZONE });
}

export interface QuotaService {
  /** Devuelve false, sin sumar nada, si superaría el límite. */
  consume(userId: string, kind: QuotaKind, amount: number): Promise<boolean>;
  release(userId: string, kind: QuotaKind, amount: number): Promise<void>;
  /** Consumo actual de cada tipo, en el periodo vigente. */
  usage(userId: string): Promise<Record<QuotaKind, number>>;
}

const okRowSchema = z.object({ ok: z.boolean() });
const usedRowSchema = z.object({
  kind: z.enum(['questions', 'storage_bytes', 'summaries', 'study_generations']),
  used: z.coerce.number(),
});

export function createQuotaService(db: Database): QuotaService {
  return {
    async consume(userId, kind, amount) {
      const rows = await db.execute(sql`
        SELECT consume_quota(
          ${userId}::uuid, ${kind}, ${periodFor(kind)}::date,
          ${amount}::bigint, ${FREE_LIMITS[kind]}::bigint
        ) AS ok
      `);
      return okRowSchema.parse(rows[0]).ok;
    },
    async release(userId, kind, amount) {
      await db.execute(sql`
        SELECT release_quota(${userId}::uuid, ${kind}, ${periodFor(kind)}::date, ${amount}::bigint)
      `);
    },
    async usage(userId) {
      const rows = await db.execute(sql`
        SELECT kind, used FROM usage_quotas
        WHERE user_id = ${userId}::uuid
          AND ((kind = 'questions' AND period_start = ${periodFor('questions')}::date)
            OR (kind = 'summaries' AND period_start = ${periodFor('summaries')}::date)
            OR (kind = 'study_generations'
              AND period_start = ${periodFor('study_generations')}::date)
            OR (kind = 'storage_bytes' AND period_start = ${periodFor('storage_bytes')}::date))
      `);
      const result: Record<QuotaKind, number> = {
        questions: 0,
        storage_bytes: 0,
        summaries: 0,
        study_generations: 0,
      };
      for (const row of rows) {
        const parsed = usedRowSchema.parse(row);
        result[parsed.kind] = parsed.used;
      }
      return result;
    },
  };
}
