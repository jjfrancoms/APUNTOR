import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAccountExportRepository } from '../../api/src/account-export';
import { createWaitlistRepository } from '../../api/src/waitlist';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';

const ROOT = join(__dirname, '..', '..', 'db');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DOC = 'aaaaaaaa-0000-4000-8000-000000000001';
const DOC_OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';

const migrations = readdirSync(join(ROOT, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(ROOT, 'migrations', f), 'utf8'));

function unit(): string {
  return `[${Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`;
}

let db: Database;

beforeAll(async () => {
  const pg = new PGlite({ extensions: { vector } });
  await pg.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
  for (const sql of migrations) await pg.exec(sql);
  await pg.exec(`
    INSERT INTO documents (id, user_id, title, file_path, status) VALUES
      ('${DOC}', '${USER}', 'Bio.pdf', '${USER}/a.pdf', 'completed'),
      ('${DOC_OTHER}', '${OTHER}', 'Ajeno.pdf', '${OTHER}/b.pdf', 'completed');
    INSERT INTO document_chunks (document_id, page_number, chunk_index, content, token_count, metadata, embedding) VALUES
      ('${DOC}', 2, 1, 'segundo', 1, '{"sectionPath":[],"charStart":0,"charEnd":7}', '${unit()}'),
      ('${DOC}', 1, 0, 'primero', 1, '{"sectionPath":[],"charStart":0,"charEnd":7}', '${unit()}'),
      ('${DOC_OTHER}', 1, 0, 'TEXTO-AJENO', 1, '{"sectionPath":[],"charStart":0,"charEnd":5}', '${unit()}');
    INSERT INTO topics (document_id, title, source_pages) VALUES
      ('${DOC}', 'Célula', '{1}'), ('${DOC_OTHER}', 'TEMA-AJENO', '{1}');
    INSERT INTO usage_quotas (user_id, kind, period_start, used) VALUES
      ('${USER}', 'questions', '2026-11-01', 4), ('${OTHER}', 'questions', '2026-11-01', 9);
  `);
  db = drizzle(pg, { schema }) as unknown as Database;
}, 60_000);

describe('exportación de la cuenta', () => {
  it('trae los fragmentos del usuario en orden, sin embeddings y sin los de otros', async () => {
    const chunks = await createAccountExportRepository(db).chunks(USER);
    expect(chunks.map((c) => [c.pageNumber, c.content])).toEqual([
      [1, 'primero'],
      [2, 'segundo'],
    ]);
    expect(Object.keys(chunks[0] ?? {})).not.toContain('embedding');
  });

  it('temas y cuotas solo del usuario', async () => {
    const repository = createAccountExportRepository(db);
    expect((await repository.topics(USER)).map((t) => t.title)).toEqual(['Célula']);
    expect(await repository.quotas(USER)).toEqual([
      { kind: 'questions', periodStart: '2026-11-01', used: 4 },
    ]);
  });
});

describe('lista de espera', () => {
  it('guarda el correo normalizado, es idempotente y se puede borrar', async () => {
    const repository = createWaitlistRepository(db);
    await repository.join({ email: 'Tutor@Example.com', consent: true, source: 'web' });
    await repository.join({ email: 'tutor@example.com', consent: true, source: 'app' });
    const list = await repository.list({ limit: 10, offset: 0 });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: 'tutor@example.com', consent: true, source: 'web' });
    expect(await repository.findByEmail('TUTOR@example.com')).not.toBeNull();
    expect(await repository.remove(list[0]?.id ?? '')).toBe(true);
    expect(await repository.list({ limit: 10, offset: 0 })).toEqual([]);
  });

  it('removeByEmail borra solo ese correo', async () => {
    const repository = createWaitlistRepository(db);
    await repository.join({ email: 'a@example.com', consent: true, source: 'app' });
    await repository.join({ email: 'b@example.com', consent: true, source: 'app' });
    await repository.removeByEmail('A@example.com');
    expect((await repository.list({ limit: 10, offset: 0 })).map((e) => e.email)).toEqual([
      'b@example.com',
    ]);
  });
});
