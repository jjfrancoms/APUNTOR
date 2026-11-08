import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createSearchRepository,
  FOLD_FROM,
  FOLD_TO,
  type SearchRepository,
} from '../../api/src/search';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';

const ROOT = join(__dirname, '..', '..', 'db');
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DOC = 'aaaaaaaa-0000-4000-8000-000000000001';
const SECOND_DOC = 'aaaaaaaa-0000-4000-8000-000000000002';
const PENDING_DOC = 'aaaaaaaa-0000-4000-8000-000000000003';
const OTHER_DOC = 'bbbbbbbb-0000-4000-8000-000000000001';
const VECTOR = `[${Array.from({ length: schema.EMBEDDING_DIMENSIONS }, () => 0).join(',')}]`;

let pg: PGlite;
let repo: SearchRepository;

async function insertDocument(
  id: string,
  userId: string,
  title: string,
  status = 'completed',
): Promise<void> {
  await pg.query(
    `INSERT INTO documents (id, user_id, title, file_path, status) VALUES ($1, $2, $3, 'f', $4)`,
    [id, userId, title, status],
  );
}

let chunkIndex = 0;
async function insertChunk(documentId: string, page: number, content: string): Promise<void> {
  chunkIndex += 1;
  await pg.query(
    `INSERT INTO document_chunks
       (document_id, page_number, chunk_index, content, token_count, metadata, embedding)
     VALUES ($1, $2, $3, $4, 1, '{"sectionPath":[],"charStart":0,"charEnd":1}', '${VECTOR}')`,
    [documentId, page, chunkIndex, content],
  );
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(join(ROOT, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pg.exec(readFileSync(join(ROOT, 'migrations', file), 'utf8'));
  }
  repo = createSearchRepository(drizzle(pg, { schema }) as unknown as Database);

  await insertDocument(DOC, USER, 'Lógica proposicional.pdf');
  await insertDocument(SECOND_DOC, USER, 'Introducción a la lógica.pdf');
  await insertDocument(PENDING_DOC, USER, 'Lógica sin procesar.pdf', 'processing');
  await insertDocument(OTHER_DOC, OTHER, 'Lógica ajena.pdf');
  await pg.exec(`
    INSERT INTO topics (document_id, title, source_pages) VALUES
      ('${DOC}', 'Límites y lógica', '{4,5}'),
      ('${PENDING_DOC}', 'Lógica oculta', '{1}'),
      ('${OTHER_DOC}', 'Lógica de otro', '{9}');
  `);
  await insertChunk(DOC, 3, 'El teorema de Bolzano garantiza una raíz en el intervalo.');
  await insertChunk(DOC, 3, 'Otra vez el teorema de Bolzano, en el solapamiento de la página.');
  await insertChunk(DOC, 7, 'Una mención a Bolzano. Más texto sin relación con la búsqueda.');
  await insertChunk(SECOND_DOC, 2, 'LÍMITES laterales de una función continua.');
  await insertChunk(PENDING_DOC, 1, 'Bolzano en un documento que aún se procesa.');
  await insertChunk(OTHER_DOC, 1, 'Bolzano en los apuntes de otra persona.');
}, 60_000);

describe('búsqueda de contenido (SQL real)', () => {
  it('encuentra documentos por título, sin acentos, y primero los que empiezan por la consulta', async () => {
    const { documents } = await repo.search(USER, 'logica');
    expect(documents.map((d) => d.title)).toEqual([
      'Lógica sin procesar.pdf',
      'Lógica proposicional.pdf',
      'Introducción a la lógica.pdf',
    ]);
  });

  it('encuentra una parte de un título', async () => {
    const { documents } = await repo.search(USER, 'posicio');
    expect(documents.map((d) => d.id)).toEqual([DOC]);
  });

  it('devuelve temas con su documento y sus páginas', async () => {
    const { topics } = await repo.search(USER, 'límites');
    expect(topics).toEqual([
      {
        id: expect.any(String) as string,
        documentId: DOC,
        documentTitle: 'Lógica proposicional.pdf',
        title: 'Límites y lógica',
        pages: [4, 5],
      },
    ]);
  });

  it('devuelve un fragmento por página, con la página y la palabra resaltada', async () => {
    const { snippets } = await repo.search(USER, 'BOLZANO');
    expect(snippets.map((s) => [s.documentId, s.pageNumber]).sort()).toEqual([
      [DOC, 3],
      [DOC, 7],
    ]);
    const first = snippets[0];
    const highlight = first?.highlights[0];
    expect(highlight).toBeDefined();
    if (first && highlight) {
      expect(first.snippet.slice(highlight.start, highlight.start + highlight.length)).toBe(
        'Bolzano',
      );
    }
  });

  it('busca por prefijo, sin distinguir mayúsculas ni acentos, y exige todas las palabras', async () => {
    const { snippets } = await repo.search(USER, 'limite func');
    expect(snippets.map((s) => s.documentId)).toEqual([SECOND_DOC]);
    expect((await repo.search(USER, 'bolzano inexistente')).snippets).toEqual([]);
  });

  it('nunca devuelve nada de otro usuario', async () => {
    const results = await repo.search(USER, 'lógica ajena');
    expect(results.documents).toEqual([]);
    const body = JSON.stringify([
      await repo.search(USER, 'Bolzano'),
      await repo.search(USER, 'lógica'),
    ]);
    expect(body).not.toContain(OTHER_DOC);
    expect(body).not.toContain('otra persona');

    const others = await repo.search(OTHER, 'Bolzano');
    expect(others.snippets.map((s) => s.documentId)).toEqual([OTHER_DOC]);
  });

  it('solo busca temas y contenido de documentos ya procesados', async () => {
    const results = await repo.search(USER, 'lógica oculta');
    expect(results.topics).toEqual([]);
    expect((await repo.search(USER, 'procesa')).snippets).toEqual([]);
  });

  it('una consulta sin palabras o con caracteres especiales no falla', async () => {
    expect(await repo.search(USER, '?? !!')).toEqual({ documents: [], topics: [], snippets: [] });
    for (const query of [`'; DROP TABLE documents; --`, 'a:* & !b', '100%', 'a_b', 'c\\d']) {
      await expect(repo.search(USER, query)).resolves.toBeDefined();
    }
    expect((await repo.search(USER, '100%')).documents).toEqual([]);
    expect((await pg.query('SELECT 1 FROM documents')).rows).toHaveLength(4);
  });

  it('el índice pendiente aplica y su expresión es la que usa el repositorio', async () => {
    const pending = readFileSync(join(ROOT, 'pending', 'search.sql'), 'utf8');
    expect(pending).toContain(FOLD_FROM);
    expect(pending).toContain(FOLD_TO);
    await pg.exec(pending);
    await pg.exec('SET enable_seqscan = off');
    const plan = await pg.query<{ 'QUERY PLAN': string }>(`
      EXPLAIN SELECT 1 FROM document_chunks
      WHERE to_tsvector('simple'::regconfig, lower(translate(content, '${FOLD_FROM}', '${FOLD_TO}')))
        @@ to_tsquery('simple'::regconfig, 'bolzano:*')
    `);
    await pg.exec('RESET enable_seqscan');
    expect(plan.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
      'document_chunks_content_fts_idx',
    );
    expect((await repo.search(USER, 'Bolzano')).snippets).toHaveLength(2);
  });
});
