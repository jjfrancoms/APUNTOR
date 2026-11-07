import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createConsentsRepository, type ConsentsRepository } from '../../api/src/consents';
import { createDocumentsRepository, type DocumentsRepository } from '../../api/src/documents';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';

const ROOT = join(__dirname, '..', '..', 'db');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DOC = 'eeeeeeee-0000-4000-8000-000000000001';
const OTHER_DOC = 'ffffffff-0000-4000-8000-000000000002';

let pg: PGlite;
let repo: DocumentsRepository;
let consentsRepo: ConsentsRepository;

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(join(ROOT, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pg.exec(readFileSync(join(ROOT, 'migrations', file), 'utf8'));
  }
  // Las consultas del repositorio no dependen del driver: se prueban sobre PGlite.
  const db = drizzle(pg, { schema }) as unknown as Database;
  repo = createDocumentsRepository(db);
  consentsRepo = createConsentsRepository(db);
}, 60_000);

describe('repositorio de documentos y cursos (SQL real)', () => {
  it('crea cursos y documentos y cuenta los temas de cada documento', async () => {
    const course = await repo.createCourse(USER, 'Cálculo I');
    await repo.create({
      id: DOC,
      userId: USER,
      courseId: course.id,
      title: 'Límites.pdf',
      filePath: `${USER}/${DOC}.pdf`,
      sizeBytes: 100,
    });
    await repo.create({
      id: OTHER_DOC,
      userId: OTHER,
      courseId: null,
      title: 'Ajeno.pdf',
      filePath: `${OTHER}/${OTHER_DOC}.pdf`,
      sizeBytes: 100,
    });
    await pg.exec(`
      INSERT INTO topics (document_id, title, source_pages) VALUES
        ('${DOC}', '1. Límites', '{1,2}'), ('${DOC}', '2. Continuidad', '{3}');
    `);

    const list = await repo.list(USER);
    expect(list.map((d) => [d.title, d.courseId, d.topicCount])).toEqual([
      ['Límites.pdf', course.id, 2],
    ]);
    expect((await repo.topics(USER, DOC)).map((t) => t.title)).toEqual([
      '1. Límites',
      '2. Continuidad',
    ]);
    expect(await repo.topics(OTHER, DOC)).toEqual([]);
    expect(await repo.getCourse(OTHER, course.id)).toBeNull();
  });

  it('renombrar y mover solo afecta los documentos propios', async () => {
    await repo.update(OTHER, DOC, { title: 'Hackeado.pdf' });
    await repo.update(USER, DOC, { title: 'Tema 1.pdf', courseId: null });
    expect(await repo.get(USER, DOC)).toMatchObject({ title: 'Tema 1.pdf', courseId: null });
  });

  it('borrar un curso deja sus documentos sin curso', async () => {
    const course = await repo.createCourse(USER, 'Física');
    await repo.update(USER, DOC, { courseId: course.id });
    await repo.deleteCourse(USER, course.id);
    expect((await repo.get(USER, DOC))?.courseId).toBeNull();
  });

  it('aceptar un consentimiento es idempotente y cada usuario ve solo los suyos', async () => {
    const first = await consentsRepo.accept(USER, 'terms', '2026-11-01');
    const again = await consentsRepo.accept(USER, 'terms', '2026-11-01');
    expect(again).toEqual(first);
    await consentsRepo.accept(USER, 'privacy', '2026-11-01');
    await consentsRepo.accept(OTHER, 'terms', '2026-11-01');

    const own = await consentsRepo.list(USER);
    expect(own.map((c) => [c.document, c.version])).toEqual([
      ['terms', '2026-11-01'],
      ['privacy', '2026-11-01'],
    ]);
    expect(own[0]?.acceptedAt).toBeInstanceOf(Date);
    const rows = await pg.query(`SELECT 1 FROM consents WHERE user_id = '${USER}'`);
    expect(rows.rows).toHaveLength(2);
    await expect(
      pg.query(
        `INSERT INTO consents (user_id, document, version) VALUES ('${USER}', 'cookies', '1')`,
      ),
    ).rejects.toThrow();
  });

  it('borrar la cuenta elimina todo lo del usuario y nada de otros', async () => {
    await pg.exec(`
      INSERT INTO usage_quotas (user_id, kind, period_start, used)
      VALUES ('${USER}', 'questions', '2026-01-01', 3), ('${OTHER}', 'questions', '2026-01-01', 1);
    `);
    await repo.deleteAllForUser(USER);
    expect(await repo.list(USER)).toEqual([]);
    expect(await repo.listCourses(USER)).toEqual([]);
    const topics = await pg.query(`SELECT 1 FROM topics WHERE document_id = '${DOC}'`);
    expect(topics.rows).toEqual([]);
    const quotas = await pg.query<{ user_id: string }>('SELECT user_id FROM usage_quotas');
    expect(quotas.rows.map((r) => r.user_id)).toEqual([OTHER]);
    expect(await consentsRepo.list(USER)).toEqual([]);
    expect(await consentsRepo.list(OTHER)).toHaveLength(1);
    expect(await repo.list(OTHER)).toHaveLength(1);
  });
});
