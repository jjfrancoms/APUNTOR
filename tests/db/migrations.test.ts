import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..', 'db');
const USER_1 = '11111111-1111-4111-8111-111111111111';
const USER_2 = '22222222-2222-4222-8222-222222222222';
const DOC_1 = 'cccccccc-0000-4000-8000-000000000001';
const DOC_2 = 'dddddddd-0000-4000-8000-000000000002';

/** Vector unitario en la dimensión indicada: distancia coseno controlada en cada test. */
function unit(axis: number): string {
  return `[${Array.from({ length: 768 }, (_, i) => (i === axis ? 1 : 0)).join(',')}]`;
}

/** Levantar Postgres y migrar tarda varios segundos si corre junto a toda la suite. */
const POSTGRES_TIMEOUT_MS = 60_000;

let pg: PGlite;

async function createMigratedDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
  const files = readdirSync(join(ROOT, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(ROOT, 'migrations', file), 'utf8'));
  }
  return db;
}

async function consume(user: string, amount: number, limit: number): Promise<boolean> {
  const { rows } = await pg.query<{ ok: boolean }>(
    `SELECT consume_quota($1, 'questions', '2026-01-01', $2, $3) AS ok`,
    [user, amount, limit],
  );
  return rows[0]?.ok ?? false;
}

beforeAll(async () => {
  pg = await createMigratedDatabase();
  await pg.exec(`
    INSERT INTO documents (id, user_id, title, file_path, status) VALUES
      ('${DOC_1}', '${USER_1}', 'A', 'u1/a.pdf', 'completed'),
      ('${DOC_2}', '${USER_2}', 'B', 'u2/b.pdf', 'completed');
    INSERT INTO document_chunks (document_id, page_number, chunk_index, content, token_count, metadata, embedding) VALUES
      ('${DOC_1}', 4, 0, 'propio', 1, '{"sectionPath":[],"charStart":0,"charEnd":6}', '${unit(0)}'),
      ('${DOC_2}', 9, 0, 'ajeno', 1, '{"sectionPath":[],"charStart":0,"charEnd":5}', '${unit(0)}');
  `);
}, POSTGRES_TIMEOUT_MS);

describe('match_user_chunks', () => {
  it('devuelve solo fragmentos del usuario, con su página', async () => {
    const { rows } = await pg.query<{ content: string; page_number: number; similarity: number }>(
      `SELECT * FROM match_user_chunks($1, $2::vector, 0.5, 8)`,
      [USER_1, unit(0)],
    );
    expect(rows.map((r) => [r.content, r.page_number])).toEqual([['propio', 4]]);
    expect(rows[0]?.similarity).toBeCloseTo(1);
  });

  it('no devuelve nada por debajo del umbral (base de la abstención)', async () => {
    const { rows } = await pg.query(`SELECT * FROM match_user_chunks($1, $2::vector, 0.5, 8)`, [
      USER_1,
      unit(1),
    ]);
    expect(rows).toEqual([]);
  });

  it('respeta el filtro por documento', async () => {
    const { rows } = await pg.query(
      `SELECT * FROM match_user_chunks($1, $2::vector, 0.5, 8, $3::uuid[])`,
      [USER_1, unit(0), [DOC_2]],
    );
    expect(rows).toEqual([]);
  });
});

describe('consume_quota', () => {
  it('acepta hasta el límite y rechaza sin sumar al pasarse', async () => {
    expect(await consume(USER_1, 2, 3)).toBe(true);
    expect(await consume(USER_1, 1, 3)).toBe(true);
    expect(await consume(USER_1, 1, 3)).toBe(false);
    const { rows } = await pg.query<{ used: string | number }>(
      `SELECT used FROM usage_quotas WHERE user_id = $1`,
      [USER_1],
    );
    expect(Number(rows[0]?.used)).toBe(3);
  });

  it('release_quota devuelve lo consumido sin bajar de cero', async () => {
    await pg.query(`SELECT release_quota($1, 'questions', '2026-01-01', 99)`, [USER_1]);
    const { rows } = await pg.query<{ used: string | number }>(
      `SELECT used FROM usage_quotas WHERE user_id = $1`,
      [USER_1],
    );
    expect(Number(rows[0]?.used)).toBe(0);
  });

  it('un consumo mayor que el límite no crea fila', async () => {
    expect(await consume(USER_2, 5, 3)).toBe(false);
    const { rows } = await pg.query(`SELECT 1 FROM usage_quotas WHERE user_id = $1`, [USER_2]);
    expect(rows).toEqual([]);
  });
});

describe('aislamiento RLS', () => {
  it(
    'pasa la verificación completa de db/ci/rls-check.sql',
    async () => {
      const script = readFileSync(join(ROOT, 'ci', 'rls-check.sql'), 'utf8').replace(
        /^\\echo.*$/mu,
        '',
      );
      // Base limpia: el script espera ver solo sus propias filas.
      const clean = await createMigratedDatabase();
      await expect(clean.exec(script)).resolves.toBeDefined();
    },
    POSTGRES_TIMEOUT_MS,
  );
});
