import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import type { FastifyInstance } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAccountExportRepository } from '../../api/src/account-export';
import { createAdminRepository, type AuthUserRecord } from '../../api/src/admin';
import { buildApp } from '../../api/src/app';
import { createConsentsRepository } from '../../api/src/consents';
import { createDocumentsRepository } from '../../api/src/documents';
import { periodFor } from '../../api/src/quota';
import { createSearchRepository } from '../../api/src/search';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';
import {
  CHUNK,
  fakeEmbedder,
  fakeGenerator,
  fakeQuota,
  fakeWaitlist,
  VALID_ANSWER,
} from '../api/helpers';

const ROOT = join(__dirname, '..', '..', 'db');
const ADMIN = '33333333-3333-4333-8333-333333333333';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DOC_OK = 'aaaaaaaa-0000-4000-8000-000000000001';
const DOC_FAILED = 'aaaaaaaa-0000-4000-8000-000000000002';
const DOC_PENDING = 'aaaaaaaa-0000-4000-8000-000000000003';
const DOC_OTHER = 'bbbbbbbb-0000-4000-8000-000000000004';
/** Texto que solo existe dentro de un fragmento: no puede aparecer en ninguna respuesta. */
const CHUNK_MARKER = 'MARCADOR-SECRETO-DEL-FRAGMENTO-42';
const QUESTION_MARKER = 'MARCADOR-PREGUNTA-99';
const AUTH_ADMIN = { authorization: 'Bearer token-admin' };
const AUTH_USER = { authorization: 'Bearer token-user' };

let pg: PGlite;
let app: FastifyInstance;
const objects = new Set<string>();
const enqueued: string[] = [];
const deletedUsers: string[] = [];

const authUsers: AuthUserRecord[] = [ADMIN, USER, OTHER].map((id, index) => ({
  id,
  email: `u${index}@example.com`,
  createdAt: new Date(Date.UTC(2026, 10, 1 + index)),
  lastSignInAt: index === 1 ? new Date(Date.UTC(2026, 10, 5)) : null,
  provider: 'email',
}));

function unit(): string {
  return `[${Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`;
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  await pg.exec(readFileSync(join(ROOT, 'ci', 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(join(ROOT, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pg.exec(readFileSync(join(ROOT, 'migrations', file), 'utf8'));
  }
  const today = periodFor('questions');
  await pg.exec(`
    INSERT INTO documents (id, user_id, title, file_path, size_bytes, status, error_message, total_pages, created_at) VALUES
      ('${DOC_OK}', '${USER}', 'Bio.pdf', '${USER}/ok.pdf', 100, 'completed', NULL, 3, '2026-11-01T00:00:00Z'),
      ('${DOC_FAILED}', '${USER}', 'Roto.pdf', '${USER}/roto.pdf', 50, 'failed', 'PDF ilegible', NULL, '2026-11-02T00:00:00Z'),
      ('${DOC_PENDING}', '${USER}', 'Nuevo.pdf', '${USER}/nuevo.pdf', 25, 'pending', NULL, NULL, '2026-11-03T00:00:00Z'),
      ('${DOC_OTHER}', '${OTHER}', 'Ajeno.pdf', '${OTHER}/ajeno.pdf', 1000, 'completed', NULL, 1, '2026-11-04T00:00:00Z');
    INSERT INTO document_chunks (document_id, page_number, chunk_index, content, token_count, metadata, embedding) VALUES
      ('${DOC_OK}', 1, 0, 'El apunte dice ${CHUNK_MARKER}', 5, '{"sectionPath":[],"charStart":0,"charEnd":10}', '${unit()}'),
      ('${DOC_OTHER}', 1, 0, 'Otro ${CHUNK_MARKER}', 2, '{"sectionPath":[],"charStart":0,"charEnd":5}', '${unit()}');
    INSERT INTO topics (document_id, title, source_pages) VALUES
      ('${DOC_OK}', '1. Célula', '{1}'), ('${DOC_OK}', '2. Mitocondria', '{2}');
    INSERT INTO usage_quotas (user_id, kind, period_start, used) VALUES
      ('${USER}', 'questions', '${today}', 4),
      ('${OTHER}', 'questions', '${today}', 2),
      ('${USER}', 'questions', '2020-01-01', 9),
      ('${USER}', 'storage_bytes', '1970-01-01', 175);
    INSERT INTO consents (user_id, document, version) VALUES
      ('${USER}', 'terms', '2026-10-01'), ('${USER}', 'privacy', '2026-10-01'),
      ('${USER}', 'terms', '2026-11-01'), ('${USER}', 'privacy', '2026-11-01'),
      ('${OTHER}', 'terms', '2026-11-01'),
      ('${ADMIN}', 'terms', '2026-10-01'), ('${ADMIN}', 'privacy', '2026-10-01');
  `);
  for (const path of [`${USER}/ok.pdf`, `${USER}/roto.pdf`, `${OTHER}/ajeno.pdf`])
    objects.add(path);

  const db = drizzle(pg, { schema }) as unknown as Database;
  app = await buildApp({
    contentSearch: createSearchRepository(db),
    authenticate: (token) =>
      Promise.resolve(
        token === 'token-admin'
          ? { userId: ADMIN, email: 'admin@example.com' }
          : token === 'token-user'
            ? { userId: USER, email: 'u1@example.com' }
            : null,
      ),
    documents: createDocumentsRepository(db),
    consents: createConsentsRepository(db),
    waitlist: fakeWaitlist(),
    accountExport: createAccountExportRepository(db),
    admin: createAdminRepository(db),
    adminEmails: ['admin@example.com'],
    authUsers: {
      list: (page, perPage) =>
        Promise.resolve({
          users: authUsers.slice((page - 1) * perPage, page * perPage),
          total: authUsers.length,
        }),
      get: (id) =>
        Promise.resolve(
          id === ADMIN
            ? { id, email: 'admin@example.com', emailConfirmedAt: new Date(Date.UTC(2026, 10, 1)) }
            : null,
        ),
    },
    storage: {
      download: () => Promise.resolve(new Uint8Array()),
      sizeOf: () => Promise.resolve(null),
      delete(key) {
        objects.delete(key);
        return Promise.resolve();
      },
      createUploadUrl: (key) => Promise.resolve(`https://r2.example/${key}`),
      upload: () => Promise.resolve(),
      createDownloadUrl: (key) => Promise.resolve(`https://r2.example/get/${key}`),
      deletePrefix(prefix) {
        for (const key of objects.keys()) if (key.startsWith(prefix)) objects.delete(key);
        return Promise.resolve();
      },
    },
    enqueue(id) {
      enqueued.push(id);
      return Promise.resolve();
    },
    quota: fakeQuota(1000),
    answer: {
      embedder: fakeEmbedder,
      search: () => Promise.resolve([{ ...CHUNK, content: `${CHUNK.content} ${CHUNK_MARKER}` }]),
      generator: fakeGenerator(VALID_ANSWER),
    },
    deleteAuthUser(userId) {
      deletedUsers.push(userId);
      return Promise.resolve();
    },
    rateLimit: false,
  });
}, 60_000);

async function get(url: string) {
  const response = await app.inject({ method: 'GET', url, headers: AUTH_ADMIN });
  expect(response.statusCode).toBe(200);
  return response;
}

describe('panel de administrador (SQL real)', () => {
  it('stats cuenta documentos por estado, bytes, preguntas de hoy y consentimientos', async () => {
    const response = await get('/v1/admin/stats');
    expect(response.json()).toEqual({
      users: 3,
      documents: { total: 4, pending: 1, processing: 0, completed: 2, failed: 1 },
      storageBytes: 1175,
      questionsToday: 6,
      // Solo USER aceptó términos y privacidad en 2026-11-01 (OTHER solo términos).
      consents: { currentVersionUsers: 1 },
    });
  });

  it('users une Supabase Auth con los conteos de la base', async () => {
    const response = await get('/v1/admin/users?page=1&perPage=50');
    expect(response.json()).toEqual({
      page: 1,
      hasMore: false,
      users: [
        {
          id: ADMIN,
          email: 'u0@example.com',
          createdAt: '2026-11-01T00:00:00.000Z',
          lastSignInAt: null,
          provider: 'email',
          documents: 0,
          storageBytes: 0,
          questionsToday: 0,
          consentVersion: '2026-10-01',
        },
        {
          id: USER,
          email: 'u1@example.com',
          createdAt: '2026-11-02T00:00:00.000Z',
          lastSignInAt: '2026-11-05T00:00:00.000Z',
          provider: 'email',
          documents: 3,
          storageBytes: 175,
          questionsToday: 4,
          consentVersion: '2026-11-01',
        },
        {
          id: OTHER,
          email: 'u2@example.com',
          createdAt: '2026-11-03T00:00:00.000Z',
          lastSignInAt: null,
          provider: 'email',
          documents: 1,
          storageBytes: 1000,
          questionsToday: 2,
          consentVersion: null,
        },
      ],
    });
  });

  it('documents lista metadatos, filtra por estado y pagina', async () => {
    const failed = await get('/v1/admin/documents?status=failed');
    expect(failed.json()).toEqual({
      page: 1,
      hasMore: false,
      documents: [
        {
          id: DOC_FAILED,
          userId: USER,
          title: 'Roto.pdf',
          sizeBytes: 50,
          status: 'failed',
          totalPages: null,
          topicCount: 0,
          errorMessage: 'PDF ilegible',
          createdAt: '2026-11-02T00:00:00.000Z',
        },
      ],
    });
    const first = await get('/v1/admin/documents?perPage=3');
    const body = first.json<{
      documents: { id: string; topicCount: number }[];
      hasMore: boolean;
    }>();
    expect(body.hasMore).toBe(true);
    expect(body.documents.map((d) => d.id)).toEqual([DOC_OTHER, DOC_PENDING, DOC_FAILED]);
    const second = await get('/v1/admin/documents?perPage=3&page=2');
    expect(second.json()).toMatchObject({
      page: 2,
      hasMore: false,
      documents: [{ id: DOC_OK, topicCount: 2 }],
    });
  });

  it('ninguna respuesta contiene texto de fragmentos, temas ni preguntas', async () => {
    const asked = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH_USER,
      payload: { question: `¿Qué es ${QUESTION_MARKER}?` },
    });
    expect(asked.statusCode).toBe(200);
    const bodies = await Promise.all(
      [
        '/v1/admin/me',
        '/v1/admin/stats',
        '/v1/admin/users',
        '/v1/admin/documents',
        '/v1/admin/audit',
      ].map(async (url) => (await get(url)).body),
    );
    for (const body of bodies) {
      expect(body).not.toContain(CHUNK_MARKER);
      expect(body).not.toContain(QUESTION_MARKER);
      expect(body).not.toContain('Mitocondria');
      expect(body).not.toContain('file_path');
      expect(body).not.toContain(`${USER}/`);
    }
  });

  it('retry solo de fallidos: lo deja pendiente sin error, lo encola y lo audita', async () => {
    const retry = (id: string) =>
      app.inject({ method: 'POST', url: `/v1/admin/documents/${id}/retry`, headers: AUTH_ADMIN });
    expect((await retry(DOC_OK)).statusCode).toBe(409);
    expect((await retry('cccccccc-0000-4000-8000-000000000009')).statusCode).toBe(404);
    expect(enqueued).toEqual([]);

    const response = await retry(DOC_FAILED);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ id: DOC_FAILED, status: 'pending' });
    expect(enqueued).toEqual([DOC_FAILED]);
    const { rows } = await pg.query<{ status: string; error_message: string | null }>(
      `SELECT status, error_message FROM documents WHERE id = $1`,
      [DOC_FAILED],
    );
    expect(rows).toEqual([{ status: 'pending', error_message: null }]);
    // Ya no está fallido: un segundo reintento no vuelve a encolar.
    expect((await retry(DOC_FAILED)).statusCode).toBe(409);
    expect(enqueued).toEqual([DOC_FAILED]);
  });

  it('borrar un usuario quita todo lo suyo y nada de otros, y queda auditado', async () => {
    const self = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/users/${ADMIN}`,
      headers: AUTH_ADMIN,
    });
    expect(self.statusCode).toBe(409);

    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/users/${USER}`,
      headers: AUTH_ADMIN,
    });
    expect(response.statusCode).toBe(204);
    expect(deletedUsers).toEqual([USER]);
    expect([...objects]).toEqual([`${OTHER}/ajeno.pdf`]);

    const count = async (table: string, user: string) =>
      (await pg.query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [user])).rows.length;
    for (const table of ['documents', 'usage_quotas', 'consents', 'courses']) {
      expect(await count(table, USER)).toBe(0);
    }
    expect(await count('documents', OTHER)).toBe(1);
    expect(await count('usage_quotas', OTHER)).toBe(1);
    expect(await count('consents', OTHER)).toBe(1);
    expect(await count('consents', ADMIN)).toBe(2);
    const chunks = await pg.query<{ document_id: string }>(
      'SELECT document_id FROM document_chunks',
    );
    expect(chunks.rows.map((r) => r.document_id)).toEqual([DOC_OTHER]);

    const audit = await get('/v1/admin/audit?perPage=1');
    expect(audit.json()).toMatchObject({
      page: 1,
      hasMore: true,
      entries: [{ adminEmail: 'admin@example.com', action: 'user.delete', target: `user:${USER}` }],
    });
    const older = await get('/v1/admin/audit?perPage=1&page=2');
    expect(older.json()).toMatchObject({
      hasMore: false,
      entries: [{ action: 'document.retry', target: `document:${DOC_FAILED}` }],
    });
    const { rows } = await pg.query<{ admin_user_id: string }>(
      'SELECT admin_user_id FROM admin_audit',
    );
    expect(rows.map((r) => r.admin_user_id)).toEqual([ADMIN, ADMIN]);
  });

  it('un usuario autenticado no lee admin_audit por RLS', async () => {
    await pg.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${ADMIN}', false);
    `);
    try {
      await expect(pg.query('SELECT * FROM admin_audit')).rejects.toThrow();
    } finally {
      await pg.exec('RESET ROLE;');
    }
  });
});
