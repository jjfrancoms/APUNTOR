import { describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from '../../api/src/app';
import { groupChunksByPage } from '../../api/src/account-export';
import { summaryKey } from '../../api/src/topic-summary';
import { fakeWaitlist } from './helpers';

const USER = '11111111-1111-4111-8111-111111111111';
const DOC = 'aaaaaaaa-0000-4000-8000-000000000001';
const SECRET_PATH = `${USER}/secreto.pdf`;
const AUTH = { authorization: 'Bearer token-1' };
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const OTHER_PATH = `${OTHER_USER}/ajeno.pdf`;

/** R2 en memoria: guarda lo que se le da y anota qué claves se leyeron. */
function fakeStorage(files: Record<string, string | Uint8Array>) {
  const reads: string[] = [];
  return {
    reads,
    download: (key: string) => {
      reads.push(key);
      const file = files[key];
      if (file === undefined) return Promise.reject(new Error('NoSuchKey'));
      return Promise.resolve(typeof file === 'string' ? new TextEncoder().encode(file) : file);
    },
  };
}

const STORED_SUMMARY = JSON.stringify({
  version: 1,
  topicId: 't1',
  model: 'gemini-secreto-3',
  blocks: [
    { type: 'heading', text: 'La célula' },
    { type: 'paragraph', text: 'Unidad básica de la vida.', pages: [1], unverified: true },
    { type: 'list', items: ['núcleo', 'membrana'], pages: [1, 2] },
    { type: 'table', caption: 'Orgánulos', header: ['a', 'b'], rows: [['1', '2']], pages: [2] },
    { type: 'formula', text: 'A → B', pages: [2] },
    {
      type: 'figure',
      page: 1,
      caption: 'Esquema',
      key: `${USER}/secreto/summaries/t1-fig-0.png`,
      width: 10,
      height: 10,
    },
    { type: 'desconocido', text: 'x' },
  ],
});

async function world(confirmed = true, overrides: Record<string, unknown> = {}) {
  const waitlist = fakeWaitlist();
  await waitlist.join({ email: 'alumno@example.com', consent: true, source: 'app' });
  const deps = {
    authenticate: (token: string) =>
      Promise.resolve(token === 'token-1' ? { userId: USER, email: 'alumno@example.com' } : null),
    documents: {
      listCourses: (userId: string) =>
        Promise.resolve(
          userId === USER ? [{ id: 'c1', title: 'Biología', createdAt: new Date(0) }] : [],
        ),
      list: (userId: string) =>
        Promise.resolve(
          userId === USER
            ? [
                {
                  id: DOC,
                  courseId: 'c1',
                  title: 'Bio.pdf',
                  filePath: SECRET_PATH,
                  sizeBytes: 100,
                  status: 'completed',
                  totalPages: 2,
                  topicCount: 1,
                  createdAt: new Date(0),
                },
              ]
            : [],
        ),
    },
    consents: {
      list: () =>
        Promise.resolve([{ document: 'terms', version: '2026-11-01', acceptedAt: new Date(0) }]),
    },
    accountExport: {
      chunks: () =>
        Promise.resolve([
          { documentId: DOC, pageNumber: 1, chunkIndex: 0, sectionTitle: 'A', content: 'uno' },
          { documentId: DOC, pageNumber: 1, chunkIndex: 1, sectionTitle: null, content: 'dos' },
          { documentId: DOC, pageNumber: 2, chunkIndex: 2, sectionTitle: null, content: 'tres' },
        ]),
      topics: () =>
        Promise.resolve([
          {
            id: 't1',
            documentId: DOC,
            parentId: null,
            title: 'Célula',
            summary: null,
            sourcePages: [1],
          },
        ]),
      quotas: () => Promise.resolve([{ kind: 'questions', periodStart: '2026-11-01', used: 3 }]),
    },
    storage: fakeStorage({}),
    quota: { usage: () => Promise.resolve({ questions: 3, storage_bytes: 100 }) },
    waitlist,
    authUsers: {
      list: () => Promise.resolve({ users: [], total: 0 }),
      get: (id: string) =>
        Promise.resolve({
          id,
          email: 'alumno@example.com',
          emailConfirmedAt: confirmed ? new Date(0) : null,
          createdAt: new Date(1000),
          metadata: { full_name: 'Ana Alumna', level: 'university', adult_confirmed: true },
        }),
    },
    rateLimit: false,
    ...overrides,
  } as unknown as AppDeps;
  return { app: await buildApp(deps), waitlist };
}

describe('GET /v1/account/export', () => {
  it('exige sesión', async () => {
    const { app } = await world();
    const response = await app.inject({ url: '/v1/account/export' });
    expect(response.statusCode).toBe(401);
  });

  it('entrega perfil, consentimientos, cursos, documentos con su texto y consumo', async () => {
    const { app } = await world();
    const response = await app.inject({ url: '/v1/account/export', headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<Record<string, unknown>>();
    expect(body.profile).toEqual({
      id: USER,
      email: 'alumno@example.com',
      createdAt: new Date(1000).toISOString(),
      fullName: 'Ana Alumna',
      level: 'university',
      adultConfirmed: true,
    });
    expect(body.consents).toHaveLength(1);
    expect(body.courses).toHaveLength(1);
    expect(body.documents).toEqual([
      expect.objectContaining({
        id: DOC,
        title: 'Bio.pdf',
        topics: [{ id: 't1', parentId: null, title: 'Célula', summary: null, sourcePages: [1] }],
        pages: [
          {
            pageNumber: 1,
            chunks: [
              { chunkIndex: 0, sectionTitle: 'A', text: 'uno' },
              { chunkIndex: 1, sectionTitle: null, text: 'dos' },
            ],
          },
          { pageNumber: 2, chunks: [{ chunkIndex: 2, sectionTitle: null, text: 'tres' }] },
        ],
      }),
    ]);
    expect(body.usage).toMatchObject({
      questionsToday: 3,
      storageBytes: 100,
      periods: [{ kind: 'questions', periodStart: '2026-11-01', used: 3 }],
    });
    expect(body.waitlist).toMatchObject({ email: 'alumno@example.com', consent: true });
  });

  it('nunca incluye la ruta del archivo en R2', async () => {
    const { app } = await world();
    const response = await app.inject({ url: '/v1/account/export', headers: AUTH });
    expect(response.body).not.toContain(SECRET_PATH);
    expect(response.body).not.toContain('filePath');
  });

  it('solo consulta los datos del usuario de la sesión', async () => {
    const seen: string[] = [];
    const record = (id: string) => {
      seen.push(id);
      return Promise.resolve([]);
    };
    const { app } = await world(true, {
      documents: { list: record, listCourses: record },
      consents: { list: record },
      accountExport: { chunks: record, topics: record, quotas: record },
    });
    const response = await app.inject({ url: '/v1/account/export', headers: AUTH });
    expect(response.statusCode).toBe(200);
    expect(seen).toHaveLength(6);
    expect(new Set(seen)).toEqual(new Set([USER]));
  });

  it('sin correo confirmado no liga la cuenta con la lista de espera', async () => {
    const { app } = await world(false);
    const response = await app.inject({ url: '/v1/account/export', headers: AUTH });
    expect(response.json<{ waitlist: unknown }>().waitlist).toBeNull();
  });
});

describe('resúmenes de IA en la exportación', () => {
  const exportOf = async (storage: ReturnType<typeof fakeStorage>) => {
    const { app } = await world(true, { storage });
    const response = await app.inject({ url: '/v1/account/export', headers: AUTH });
    expect(response.statusCode).toBe(200);
    return response;
  };

  it('incluye el tema y sus bloques con páginas, sin claves ni modelo', async () => {
    const storage = fakeStorage({ [summaryKey(SECRET_PATH, 't1')]: STORED_SUMMARY });
    const response = await exportOf(storage);
    const body = response.json<{ documents: { aiSummaries: unknown }[] }>();
    expect(body.documents[0]?.aiSummaries).toEqual([
      {
        topicId: 't1',
        blocks: [
          { type: 'heading', text: 'La célula' },
          { type: 'paragraph', text: 'Unidad básica de la vida.', pages: [1] },
          { type: 'list', items: ['núcleo', 'membrana'], pages: [1, 2] },
          {
            type: 'table',
            caption: 'Orgánulos',
            header: ['a', 'b'],
            rows: [['1', '2']],
            pages: [2],
          },
          { type: 'formula', text: 'A → B', pages: [2] },
          { type: 'figure', page: 1, caption: 'Esquema' },
        ],
      },
    ]);
    expect(response.body).not.toContain('gemini-secreto');
    expect(response.body).not.toContain('summaries/');
    expect(response.body).not.toContain('-fig-');
    expect(response.body).not.toContain(SECRET_PATH);
    expect(response.body).not.toContain('"model"');
    expect(response.body).not.toContain('"key"');
  });

  it('un resumen faltante o dañado no rompe la exportación', async () => {
    const missing = await exportOf(fakeStorage({}));
    expect(
      missing.json<{ documents: { aiSummaries: unknown }[] }>().documents[0]?.aiSummaries,
    ).toEqual([]);
    for (const bad of ['no es json {', '{"blocks": "x"}', '{"blocks": [{"type": "x"}]}']) {
      const corrupt = await exportOf(fakeStorage({ [summaryKey(SECRET_PATH, 't1')]: bad }));
      expect(
        corrupt.json<{ documents: { aiSummaries: unknown }[] }>().documents[0]?.aiSummaries,
      ).toEqual([]);
    }
  });

  it('un fallo de R2 no rompe la exportación', async () => {
    const storage = { download: () => Promise.reject(new Error('R2 caído')) };
    const { app } = await world(true, { storage });
    const response = await app.inject({ url: '/v1/account/export', headers: AUTH });
    expect(response.statusCode).toBe(200);
  });

  it('solo lee archivos de los documentos del usuario', async () => {
    const storage = fakeStorage({
      [summaryKey(SECRET_PATH, 't1')]: STORED_SUMMARY,
      [summaryKey(OTHER_PATH, 't1')]: STORED_SUMMARY.replace('La célula', 'DATO-AJENO'),
      [summaryKey(SECRET_PATH, 'tema-ajeno')]: STORED_SUMMARY.replace('La célula', 'TEMA-AJENO'),
    });
    const response = await exportOf(storage);
    expect(storage.reads).toEqual([summaryKey(SECRET_PATH, 't1')]);
    expect(response.body).not.toContain('DATO-AJENO');
    expect(response.body).not.toContain('TEMA-AJENO');
  });

  it('notIncluded no menciona ya los resúmenes y sí las imágenes', async () => {
    const response = await exportOf(fakeStorage({}));
    const { notIncluded } = response.json<{ notIncluded: string[] }>();
    expect(notIncluded).toContain('summary_figure_images');
    expect(notIncluded).not.toContain('derived_files');
  });
});

describe('groupChunksByPage', () => {
  it('no mezcla páginas ni documentos', () => {
    const chunk = (documentId: string, pageNumber: number, chunkIndex: number) => ({
      documentId,
      pageNumber,
      chunkIndex,
      sectionTitle: null,
      content: `${documentId}-${chunkIndex}`,
    });
    const grouped = groupChunksByPage([chunk('a', 1, 0), chunk('a', 3, 1), chunk('b', 1, 0)]);
    expect(grouped.get('a')?.map((p) => p.pageNumber)).toEqual([1, 3]);
    expect(grouped.get('b')?.map((p) => p.pageNumber)).toEqual([1]);
  });
});
