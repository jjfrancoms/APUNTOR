import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAccountExportRepository,
  type AccountExportRepository,
} from '../../api/src/account-export';
import { createDocumentsRepository, type DocumentsRepository } from '../../api/src/documents';
import { createQuotaService, FREE_LIMITS, type QuotaService } from '../../api/src/quota';
import type { ValidStudyItem } from '../../api/src/study/generate';
import { createStudyRepository, type StudyRepository } from '../../api/src/study/repository';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';

const ROOT = join(__dirname, '..', '..', 'db');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DOC = 'eeeeeeee-0000-4000-8000-000000000001';
const OTHER_DOC = 'ffffffff-0000-4000-8000-000000000002';
const CHUNK = 'eeeeeeee-0000-4000-8000-0000000000c1';
const TODAY = '2026-11-08';

/**
 * Las tablas llegan con la migración que se genera al integrar la fase 3 (`db/pending/study.sql`
 * va detrás). Hasta entonces estas pruebas se omiten: la migración no se versiona en esta rama.
 */
const migrations = readdirSync(join(ROOT, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();
const hasTables = migrations.some((file) =>
  readFileSync(join(ROOT, 'migrations', file), 'utf8').includes('CREATE TABLE "study_sets"'),
);

const cards = (n: number): ValidStudyItem[] =>
  Array.from({ length: n }, (_, i) => ({
    payload: { kind: 'cards', front: `F${i}`, back: `B${i}`, quote: 'una cita literal' },
    citation: { chunkId: CHUNK, documentId: DOC, pageNumber: 7, quote: 'una cita literal' },
  }));

const quizItems: ValidStudyItem[] = [
  {
    payload: {
      kind: 'quiz',
      question: '¿Qué?',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 1,
      explanation: 'Porque.',
      quote: 'una cita literal',
    },
    citation: { chunkId: CHUNK, documentId: DOC, pageNumber: 7, quote: 'una cita literal' },
  },
];

describe.skipIf(!hasTables)('estudio (SQL real)', () => {
  let pg: PGlite;
  let repo: StudyRepository;
  let documents: DocumentsRepository;
  let accountExport: AccountExportRepository;
  let quota: QuotaService;

  const count = async (table: string): Promise<number> => {
    const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return rows[0]?.n ?? 0;
  };

  beforeAll(async () => {
    pg = new PGlite({ extensions: { vector } });
    await pg.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
    for (const file of migrations) {
      await pg.exec(readFileSync(join(ROOT, 'migrations', file), 'utf8'));
    }
    const pending = join(ROOT, 'pending', 'study.sql');
    if (existsSync(pending)) await pg.exec(readFileSync(pending, 'utf8'));

    const db = drizzle(pg, { schema }) as unknown as Database;
    accountExport = createAccountExportRepository(db);
    repo = createStudyRepository(db);
    documents = createDocumentsRepository(db);
    // PGlite devuelve `{ rows }` y postgres.js un arreglo, que es lo que espera el servicio.
    const raw = db as unknown as { execute(query: unknown): Promise<{ rows: unknown[] }> };
    quota = createQuotaService({
      execute: async (query: unknown) => (await raw.execute(query)).rows,
    } as unknown as Database);

    await pg.exec(`
      INSERT INTO documents (id, user_id, title, file_path, status) VALUES
        ('${DOC}', '${USER}', 'Bio.pdf', 'u/a.pdf', 'completed'),
        ('${OTHER_DOC}', '${OTHER}', 'Ajeno.pdf', 'o/b.pdf', 'completed');
      INSERT INTO document_chunks
        (id, document_id, page_number, chunk_index, content, token_count, metadata, embedding)
      VALUES ('${CHUNK}', '${DOC}', 7, 0, 'una cita literal del apunte', 5,
        '{"sectionPath":["Tema"],"charStart":0,"charEnd":5}'::jsonb,
        array_fill(0.1::real, ARRAY[768])::vector);
    `);
  }, 60_000);

  afterAll(async () => {
    await pg.close();
  });

  const createCards = (n = 3) =>
    repo.createSet({
      userId: USER,
      documentId: DOC,
      topicId: null,
      kind: 'cards',
      items: cards(n),
      today: TODAY,
    });

  it('entrega los fragmentos del documento solo a su dueño', async () => {
    const own = await repo.sourceChunks(USER, DOC);
    expect(own.map((c) => [c.id, c.pageNumber, c.sectionPath])).toEqual([[CHUNK, 7, ['Tema']]]);
    expect(await repo.sourceChunks(OTHER, DOC)).toEqual([]);
  });

  it('las tarjetas nuevas quedan para hoy, en orden y con página del fragmento', async () => {
    const { set, items } = await createCards(3);
    expect(set).toMatchObject({ kind: 'cards', itemCount: 3, documentTitle: 'Bio.pdf' });
    expect(items.map((i) => (i.payload.kind === 'cards' ? i.payload.front : ''))).toEqual([
      'F0',
      'F1',
      'F2',
    ]);
    expect(items[0]).toMatchObject({ chunkId: CHUNK, documentId: DOC, page: 7 });
    const due = await repo.dueToday(USER, TODAY);
    expect(due.filter((d) => d.setId === set.id)).toHaveLength(3);
    expect(await repo.dueToday(OTHER, TODAY)).toEqual([]);
    await repo.deleteSet(USER, set.id);
  });

  it('un quiz no entra al repaso ni acepta repasos', async () => {
    const { set, items } = await repo.createSet({
      userId: USER,
      documentId: DOC,
      topicId: null,
      kind: 'quiz',
      items: quizItems,
      today: TODAY,
    });
    expect((await repo.dueToday(USER, TODAY)).some((d) => d.setId === set.id)).toBe(false);
    expect(await repo.review(USER, items[0]?.id ?? '', true, TODAY)).toBeNull();
    expect(await repo.recordResult(OTHER, set.id, 1, 1)).toBe(false);
    expect(await repo.recordResult(USER, set.id, 1, 1)).toBe(true);
    expect((await repo.getSet(USER, set.id))?.set).toMatchObject({ lastScore: 1, lastTotal: 1 });
    await repo.deleteSet(USER, set.id);
  });

  it('el repaso mueve la caja y la fecha, y lo sale de hoy', async () => {
    const { set, items } = await createCards(1);
    const id = items[0]?.id ?? '';
    expect(await repo.review(OTHER, id, true, TODAY)).toBeNull();
    expect(await repo.review(USER, id, true, TODAY)).toEqual({ box: 1, dueDate: '2026-11-11' });
    expect((await repo.dueToday(USER, TODAY)).some((d) => d.id === id)).toBe(false);
    expect((await repo.dueToday(USER, '2026-11-11')).some((d) => d.id === id)).toBe(true);
    expect(await repo.review(USER, id, true, '2026-11-11')).toEqual({
      box: 2,
      dueDate: '2026-11-18',
    });
    expect(await repo.review(USER, id, false, '2026-11-18')).toEqual({
      box: 0,
      dueDate: '2026-11-19',
    });
    await repo.deleteSet(USER, set.id);
  });

  it('lista por documento y tipo; lo ajeno no se ve ni se borra', async () => {
    const { set } = await createCards(1);
    expect((await repo.listSets(USER, { kind: 'cards' })).map((s) => s.id)).toContain(set.id);
    expect(await repo.listSets(USER, { kind: 'quiz' })).toEqual([]);
    expect(await repo.listSets(USER, { documentId: OTHER_DOC })).toEqual([]);
    expect(await repo.listSets(OTHER, {})).toEqual([]);
    expect(await repo.getSet(OTHER, set.id)).toBeNull();
    expect(await repo.deleteSet(OTHER, set.id)).toBe(false);
    expect(await repo.deleteSet(USER, set.id)).toBe(true);
    expect(await count('study_items')).toBe(0);
    expect(await count('study_reviews')).toBe(0);
  });

  it('la cuota de generaciones es atómica, diaria y se devuelve', async () => {
    const limit = FREE_LIMITS.study_generations;
    expect(limit).toBe(10);
    const results = await Promise.all(
      Array.from({ length: limit + 3 }, () => quota.consume(USER, 'study_generations', 1)),
    );
    expect(results.filter(Boolean)).toHaveLength(limit);
    await quota.release(USER, 'study_generations', 1);
    expect((await quota.usage(USER)).study_generations).toBe(limit - 1);
  });

  it('RLS: cada usuario solo lee lo suyo y no escribe', async () => {
    const { set } = await createCards(1);
    const asUser = async (userId: string) => {
      await pg.exec(`
        SET ROLE authenticated;
        SELECT set_config('request.jwt.claim.sub', '${userId}', false);
      `);
      try {
        return {
          sets: await count('study_sets'),
          items: await count('study_items'),
          reviews: await count('study_reviews'),
        };
      } finally {
        await pg.exec('RESET ROLE');
      }
    };
    expect(await asUser(USER)).toEqual({ sets: 1, items: 1, reviews: 1 });
    expect(await asUser(OTHER)).toEqual({ sets: 0, items: 0, reviews: 0 });
    await pg.exec('SET ROLE authenticated');
    await expect(pg.exec(`DELETE FROM study_sets WHERE id = '${set.id}'`)).rejects.toThrow();
    await pg.exec('RESET ROLE');
    await repo.deleteSet(USER, set.id);
  });

  it('la exportación trae solo el estudio del propio usuario', async () => {
    await createCards(2);
    const sets = await accountExport.studySets(USER);
    expect(sets.length).toBeGreaterThan(0);
    const setIds = new Set(sets.map((set) => set.id));
    const items = await accountExport.studyItems(USER);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((item) => setIds.has(item.setId))).toBe(true);
    expect((await accountExport.studyReviews(USER)).length).toBeGreaterThanOrEqual(2);
    expect(await accountExport.studySets(OTHER)).toEqual([]);
    expect(await accountExport.studyItems(OTHER)).toEqual([]);
    expect(await accountExport.studyReviews(OTHER)).toEqual([]);
  });

  it('borrar el documento y borrar la cuenta se llevan todo el estudio', async () => {
    await createCards(2);
    await documents.delete(USER, DOC);
    expect(await count('study_sets')).toBe(0);
    expect(await count('study_items')).toBe(0);
    expect(await count('study_reviews')).toBe(0);

    await pg.exec(`
      INSERT INTO documents (id, user_id, title, file_path, status)
      VALUES ('${DOC}', '${USER}', 'Bio.pdf', 'u/a.pdf', 'completed');
      INSERT INTO document_chunks
        (id, document_id, page_number, chunk_index, content, token_count, metadata, embedding)
      VALUES ('${CHUNK}', '${DOC}', 7, 0, 'una cita literal del apunte', 5,
        '{"sectionPath":[],"charStart":0,"charEnd":5}'::jsonb,
        array_fill(0.1::real, ARRAY[768])::vector);
    `);
    await createCards(2);
    await documents.deleteAllForUser(USER);
    expect(await count('study_sets')).toBe(0);
    expect(await count('study_items')).toBe(0);
    expect(await count('study_reviews')).toBe(0);
  });
});
