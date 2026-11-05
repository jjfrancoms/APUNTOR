import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from '../../api/src/app';
import type { DocumentRecord } from '../../api/src/documents';
import { CHUNK, fakeEmbedder, fakeGenerator, fakeQuota, VALID_ANSWER } from './helpers';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const AUTH = { authorization: 'Bearer token-1' };
const AUTH_OTHER = { authorization: 'Bearer token-2' };

interface World {
  app: FastifyInstance;
  docs: Map<string, DocumentRecord & { userId: string }>;
  objects: Map<string, number>;
  enqueued: string[];
  quota: ReturnType<typeof fakeQuota>;
}

async function createWorld(overrides: Partial<AppDeps> = {}): Promise<World> {
  const docs: World['docs'] = new Map();
  const objects: World['objects'] = new Map();
  const enqueued: string[] = [];
  const quota = fakeQuota(1000);
  const app = await buildApp({
    authenticate: (token) =>
      Promise.resolve(token === 'token-1' ? USER : token === 'token-2' ? OTHER : null),
    documents: {
      create(input) {
        docs.set(input.id, {
          ...input,
          status: 'pending',
          totalPages: null,
          createdAt: new Date(0),
        });
        return Promise.resolve();
      },
      get(userId, id) {
        const doc = docs.get(id);
        return Promise.resolve(doc?.userId === userId ? doc : null);
      },
      list: (userId) => Promise.resolve([...docs.values()].filter((d) => d.userId === userId)),
      delete(_userId, id) {
        docs.delete(id);
        return Promise.resolve();
      },
      markFailed(id) {
        const doc = docs.get(id);
        if (doc) doc.status = 'failed';
        return Promise.resolve();
      },
    },
    storage: {
      download: () => Promise.resolve(new Uint8Array()),
      sizeOf: (key) => Promise.resolve(objects.get(key) ?? null),
      delete(key) {
        objects.delete(key);
        return Promise.resolve();
      },
      createUploadUrl: (key) => Promise.resolve(`https://r2.example/${key}`),
    },
    enqueue(id) {
      enqueued.push(id);
      return Promise.resolve();
    },
    quota,
    answer: {
      embedder: fakeEmbedder,
      search: () => Promise.resolve([CHUNK]),
      generator: fakeGenerator(VALID_ANSWER),
    },
    ...overrides,
  });
  return { app, docs, objects, enqueued, quota };
}

function errorCode(response: { json: () => unknown }): unknown {
  return (response.json() as { error: { code: string } }).error.code;
}

async function createDocument(world: World, sizeBytes = 100): Promise<string> {
  const response = await world.app.inject({
    method: 'POST',
    url: '/v1/documents',
    headers: AUTH,
    payload: { fileName: 'apuntes.pdf', sizeBytes },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ documentId: string }>().documentId;
}

describe('autenticación', () => {
  it('exige un token válido', async () => {
    const { app } = await createWorld();
    const missing = await app.inject({ method: 'GET', url: '/v1/documents' });
    const invalid = await app.inject({
      method: 'GET',
      url: '/v1/documents',
      headers: { authorization: 'Bearer malo' },
    });
    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
    expect(errorCode(missing)).toBe('AUTH_REQUIRED');
  });

  it('/health no la necesita', async () => {
    const { app } = await createWorld();
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });
});

describe('subida de documentos', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  it.each(['apuntes.pdf', 'clase.PPTX', 'tema.docx', 'foto.jpg', 'foto.png', 'foto.heic'])(
    'acepta %s',
    async (fileName) => {
      const response = await world.app.inject({
        method: 'POST',
        url: '/v1/documents',
        headers: AUTH,
        payload: { fileName, sizeBytes: 10 },
      });
      expect(response.statusCode).toBe(201);
    },
  );

  it.each(['video.mp4', 'sin-extension', 'viejo.doc'])('rechaza %s con UP_FORMAT', async (name) => {
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: AUTH,
      payload: { fileName: name, sizeBytes: 10 },
    });
    expect(errorCode(response)).toBe('UP_FORMAT');
    expect(world.quota.used).toBe(0);
  });

  it('rechaza más de 50 MB con UP_SIZE', async () => {
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: AUTH,
      payload: { fileName: 'a.pdf', sizeBytes: 50 * 1024 * 1024 + 1 },
    });
    expect(errorCode(response)).toBe('UP_SIZE');
  });

  it('rechaza con UP_QUOTA si no queda espacio', async () => {
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: AUTH,
      payload: { fileName: 'a.pdf', sizeBytes: 1001 },
    });
    expect(errorCode(response)).toBe('UP_QUOTA');
  });

  it('guarda el archivo en la carpeta del usuario, sin usar el nombre recibido', async () => {
    const id = await createDocument(world);
    expect(world.docs.get(id)?.filePath).toBe(`${USER}/${id}.pdf`);
  });

  it('complete encola y responde 202 sin procesar nada', async () => {
    const id = await createDocument(world);
    world.objects.set(`${USER}/${id}.pdf`, 100);
    const response = await world.app.inject({
      method: 'POST',
      url: `/v1/documents/${id}/complete`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(202);
    expect(world.enqueued).toEqual([id]);
    expect(world.docs.get(id)?.status).toBe('pending');
  });

  it('complete sin archivo subido no encola', async () => {
    const id = await createDocument(world);
    const response = await world.app.inject({
      method: 'POST',
      url: `/v1/documents/${id}/complete`,
      headers: AUTH,
    });
    expect(errorCode(response)).toBe('UP_NETWORK');
    expect(world.enqueued).toEqual([]);
  });

  it('si lo subido no coincide con lo declarado, borra el archivo y devuelve la cuota', async () => {
    const id = await createDocument(world, 100);
    world.objects.set(`${USER}/${id}.pdf`, 900);
    const response = await world.app.inject({
      method: 'POST',
      url: `/v1/documents/${id}/complete`,
      headers: AUTH,
    });
    expect(errorCode(response)).toBe('UP_SIZE');
    expect(world.objects.size).toBe(0);
    expect(world.quota.used).toBe(0);
    expect(world.enqueued).toEqual([]);
  });
});

describe('aislamiento y borrado', () => {
  it('otro usuario no ve, completa ni borra el documento', async () => {
    const world = await createWorld();
    const id = await createDocument(world);
    for (const request of [
      { method: 'GET', url: `/v1/documents/${id}` },
      { method: 'POST', url: `/v1/documents/${id}/complete` },
      { method: 'DELETE', url: `/v1/documents/${id}` },
    ] as const) {
      const response = await world.app.inject({ ...request, headers: AUTH_OTHER });
      expect(response.statusCode).toBe(404);
    }
    expect(world.docs.has(id)).toBe(true);
  });

  it('borrar elimina el archivo y libera el espacio', async () => {
    const world = await createWorld();
    const id = await createDocument(world);
    world.objects.set(`${USER}/${id}.pdf`, 100);
    const response = await world.app.inject({
      method: 'DELETE',
      url: `/v1/documents/${id}`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(204);
    expect(world.objects.size).toBe(0);
    expect(world.quota.used).toBe(0);
  });

  it('las respuestas no exponen la ruta interna del archivo', async () => {
    const world = await createWorld();
    await createDocument(world);
    const response = await world.app.inject({
      method: 'GET',
      url: '/v1/documents',
      headers: AUTH,
    });
    expect(response.body).not.toContain('apuntes.pdf"filePath');
    expect(response.body).not.toContain('filePath');
  });
});

describe('preguntas', () => {
  const payload = { question: '¿Qué produce la mitocondria?' };

  it('responde con citas por afirmación, sin datos de consumo', async () => {
    const { app } = await createWorld();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH,
      payload,
    });
    const body = response.json<Record<string, unknown>>();
    expect(body.status).toBe('answered');
    expect(body).toHaveProperty('claims');
    expect(body).not.toHaveProperty('usage');
    expect(body).not.toHaveProperty('external');
  });

  it('no consulta internet si no se pide', async () => {
    let searches = 0;
    const { app } = await createWorld({
      externalSearch: () => {
        searches += 1;
        return Promise.resolve([]);
      },
    });
    await app.inject({ method: 'POST', url: '/v1/questions', headers: AUTH, payload });
    expect(searches).toBe(0);
  });

  it('lo externo viaja aparte y etiquetado, fuera de las afirmaciones', async () => {
    const { app } = await createWorld({
      externalSearch: () =>
        Promise.resolve([
          { title: 'Web', url: 'https://example.com', snippet: 'dato de internet' },
        ]),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH,
      payload: { ...payload, includeExternal: true },
    });
    const body = response.json<{ claims: unknown; external: { source: string } }>();
    expect(body.external.source).toBe('internet');
    expect(JSON.stringify(body.claims)).not.toContain('dato de internet');
  });

  it('un fallo de la búsqueda externa no tumba la respuesta', async () => {
    const { app } = await createWorld({
      externalSearch: () => Promise.reject(new Error('caído')),
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH,
      payload: { ...payload, includeExternal: true },
    });
    const body = response.json<{ status: string; external: unknown }>();
    expect(body.status).toBe('answered');
    expect(body.external).toEqual({ unavailable: true });
  });

  it('un fallo del modelo se expresa como CHAT_FAILED', async () => {
    const { app } = await createWorld({
      answer: {
        embedder: fakeEmbedder,
        search: () => Promise.resolve([CHUNK]),
        generator: { generateJson: () => Promise.reject(new Error('secreto interno')) },
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH,
      payload,
    });
    expect(response.statusCode).toBe(502);
    expect(errorCode(response)).toBe('CHAT_FAILED');
    expect(response.body).not.toContain('secreto');
  });

  it('rechaza una pregunta vacía', async () => {
    const { app } = await createWorld();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH,
      payload: { question: '   ' },
    });
    expect(errorCode(response)).toBe('REQ_INVALID');
  });
});
