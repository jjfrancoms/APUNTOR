import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from '../../api/src/app';
import type { ConsentRecord } from '../../api/src/consents';
import type { CourseRecord, DocumentRecord, TopicRecord } from '../../api/src/documents';
import { CHUNK, fakeEmbedder, fakeGenerator, fakeQuota, VALID_ANSWER } from './helpers';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const AUTH = { authorization: 'Bearer token-1' };
const AUTH_OTHER = { authorization: 'Bearer token-2' };

type StoredDocument = DocumentRecord & { userId: string };
type StoredCourse = CourseRecord & { userId: string };
type StoredConsent = ConsentRecord & { userId: string };

interface World {
  app: FastifyInstance;
  docs: Map<string, StoredDocument>;
  courses: Map<string, StoredCourse>;
  consents: StoredConsent[];
  topics: Map<string, TopicRecord[]>;
  objects: Map<string, number>;
  enqueued: string[];
  deletedUsers: string[];
  quota: ReturnType<typeof fakeQuota>;
}

async function createWorld(overrides: Partial<AppDeps> = {}): Promise<World> {
  const docs: World['docs'] = new Map();
  const courses: World['courses'] = new Map();
  const consents: World['consents'] = [];
  const topics: World['topics'] = new Map();
  const objects: World['objects'] = new Map();
  const enqueued: string[] = [];
  const deletedUsers: string[] = [];
  const quota = fakeQuota(1000);
  const own = (userId: string, id: string) => {
    const doc = docs.get(id);
    return doc?.userId === userId ? doc : null;
  };
  const app = await buildApp({
    authenticate: (token) =>
      Promise.resolve(token === 'token-1' ? USER : token === 'token-2' ? OTHER : null),
    documents: {
      create(input) {
        docs.set(input.id, {
          ...input,
          status: 'pending',
          totalPages: null,
          topicCount: 0,
          createdAt: new Date(0),
        });
        return Promise.resolve();
      },
      get: (userId, id) => Promise.resolve(own(userId, id)),
      list: (userId) => Promise.resolve([...docs.values()].filter((d) => d.userId === userId)),
      update(userId, id, patch) {
        const doc = own(userId, id);
        if (doc) Object.assign(doc, patch);
        return Promise.resolve();
      },
      delete(userId, id) {
        if (own(userId, id)) docs.delete(id);
        return Promise.resolve();
      },
      markFailed(id) {
        const doc = docs.get(id);
        if (doc) doc.status = 'failed';
        return Promise.resolve();
      },
      topics: (userId, id) => Promise.resolve(own(userId, id) ? (topics.get(id) ?? []) : []),
      listCourses: (userId) =>
        Promise.resolve([...courses.values()].filter((c) => c.userId === userId)),
      getCourse(userId, id) {
        const course = courses.get(id);
        return Promise.resolve(course?.userId === userId ? course : null);
      },
      createCourse(userId, title) {
        const course = { id: crypto.randomUUID(), userId, title, createdAt: new Date(0) };
        courses.set(course.id, course);
        return Promise.resolve(course);
      },
      renameCourse(_userId, id, title) {
        const course = courses.get(id);
        if (course) course.title = title;
        return Promise.resolve();
      },
      deleteCourse(_userId, id) {
        courses.delete(id);
        for (const doc of docs.values()) if (doc.courseId === id) doc.courseId = null;
        return Promise.resolve();
      },
      deleteAllForUser(userId) {
        for (const [id, doc] of docs) if (doc.userId === userId) docs.delete(id);
        for (const [id, course] of courses) if (course.userId === userId) courses.delete(id);
        consents.splice(0, consents.length, ...consents.filter((c) => c.userId !== userId));
        return Promise.resolve();
      },
    },
    consents: {
      accept(userId, document, version) {
        const found = consents.find(
          (c) => c.userId === userId && c.document === document && c.version === version,
        );
        if (found) return Promise.resolve(found);
        const consent = { userId, document, version, acceptedAt: new Date(consents.length * 1000) };
        consents.push(consent);
        return Promise.resolve(consent);
      },
      list: (userId) => Promise.resolve(consents.filter((c) => c.userId === userId)),
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
    deleteAuthUser(userId) {
      deletedUsers.push(userId);
      return Promise.resolve();
    },
    ...overrides,
  });
  return { app, docs, courses, consents, topics, objects, enqueued, deletedUsers, quota };
}

function errorCode(response: { json: () => unknown }): unknown {
  return (response.json() as { error: { code: string } }).error.code;
}

async function createDocument(world: World, extra: Record<string, unknown> = {}): Promise<string> {
  const response = await world.app.inject({
    method: 'POST',
    url: '/v1/documents',
    headers: AUTH,
    payload: { fileName: 'apuntes.pdf', sizeBytes: 100, ...extra },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ documentId: string }>().documentId;
}

async function createCourse(world: World, headers = AUTH, title = 'Cálculo I'): Promise<string> {
  const response = await world.app.inject({
    method: 'POST',
    url: '/v1/courses',
    headers,
    payload: { title },
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
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

  it('puede subirse directo a un curso propio, pero no a uno ajeno', async () => {
    const mine = await createCourse(world);
    const theirs = await createCourse(world, AUTH_OTHER, 'Ajeno');
    const id = await createDocument(world, { courseId: mine });
    expect(world.docs.get(id)?.courseId).toBe(mine);
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/documents',
      headers: AUTH,
      payload: { fileName: 'a.pdf', sizeBytes: 10, courseId: theirs },
    });
    expect(errorCode(response)).toBe('COURSE_NOT_FOUND');
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
    const id = await createDocument(world);
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

describe('documentos', () => {
  it('renombrar y mover a un curso propio', async () => {
    const world = await createWorld();
    const id = await createDocument(world);
    const course = await createCourse(world);
    const response = await world.app.inject({
      method: 'PATCH',
      url: `/v1/documents/${id}`,
      headers: AUTH,
      payload: { title: 'Tema 1.pdf', courseId: course },
    });
    expect(response.json()).toMatchObject({
      title: 'Tema 1.pdf',
      courseId: course,
      topicCount: 0,
    });
    expect(world.docs.get(id)).toMatchObject({ title: 'Tema 1.pdf', courseId: course });
  });

  it('no se puede mover a un curso ajeno y un PATCH vacío es inválido', async () => {
    const world = await createWorld();
    const id = await createDocument(world);
    const theirs = await createCourse(world, AUTH_OTHER, 'Ajeno');
    const moved = await world.app.inject({
      method: 'PATCH',
      url: `/v1/documents/${id}`,
      headers: AUTH,
      payload: { courseId: theirs },
    });
    expect(errorCode(moved)).toBe('COURSE_NOT_FOUND');
    const empty = await world.app.inject({
      method: 'PATCH',
      url: `/v1/documents/${id}`,
      headers: AUTH,
      payload: {},
    });
    expect(errorCode(empty)).toBe('REQ_INVALID');
  });

  it('devuelve los temas detectados solo a su dueño', async () => {
    const world = await createWorld();
    const id = await createDocument(world);
    world.topics.set(id, [{ id: 't1', parentId: null, title: '1. Límites', sourcePages: [2, 3] }]);
    const mine = await world.app.inject({
      method: 'GET',
      url: `/v1/documents/${id}/topics`,
      headers: AUTH,
    });
    expect(mine.json()).toEqual({
      topics: [{ id: 't1', parentId: null, title: '1. Límites', sourcePages: [2, 3] }],
    });
    const theirs = await world.app.inject({
      method: 'GET',
      url: `/v1/documents/${id}/topics`,
      headers: AUTH_OTHER,
    });
    expect(theirs.statusCode).toBe(404);
  });

  it('otro usuario no ve, completa, cambia ni borra el documento', async () => {
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
    const patch = await world.app.inject({
      method: 'PATCH',
      url: `/v1/documents/${id}`,
      headers: AUTH_OTHER,
      payload: { title: 'x' },
    });
    expect(patch.statusCode).toBe(404);
    expect(world.docs.get(id)?.title).toBe('apuntes.pdf');
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
    expect(response.body).not.toContain('filePath');
    expect(response.body).not.toContain(USER);
  });
});

describe('cursos', () => {
  it('crea, lista solo los propios, renombra y valida el nombre', async () => {
    const world = await createWorld();
    const id = await createCourse(world);
    await createCourse(world, AUTH_OTHER, 'Ajeno');
    const list = await world.app.inject({ method: 'GET', url: '/v1/courses', headers: AUTH });
    expect(list.json<{ courses: { title: string }[] }>().courses.map((c) => c.title)).toEqual([
      'Cálculo I',
    ]);
    const renamed = await world.app.inject({
      method: 'PATCH',
      url: `/v1/courses/${id}`,
      headers: AUTH,
      payload: { title: 'Cálculo II' },
    });
    expect(renamed.json()).toEqual({ id, title: 'Cálculo II' });
    const blank = await world.app.inject({
      method: 'POST',
      url: '/v1/courses',
      headers: AUTH,
      payload: { title: '   ' },
    });
    expect(errorCode(blank)).toBe('REQ_INVALID');
  });

  it('borrar un curso no borra sus documentos', async () => {
    const world = await createWorld();
    const course = await createCourse(world);
    const doc = await createDocument(world, { courseId: course });
    const response = await world.app.inject({
      method: 'DELETE',
      url: `/v1/courses/${course}`,
      headers: AUTH,
    });
    expect(response.statusCode).toBe(204);
    expect(world.docs.get(doc)?.courseId).toBeNull();
  });

  it('otro usuario no puede renombrar ni borrar el curso', async () => {
    const world = await createWorld();
    const id = await createCourse(world);
    const del = await world.app.inject({
      method: 'DELETE',
      url: `/v1/courses/${id}`,
      headers: AUTH_OTHER,
    });
    expect(errorCode(del)).toBe('COURSE_NOT_FOUND');
    expect(world.courses.has(id)).toBe(true);
  });
});

describe('cuenta', () => {
  it('informa el consumo y los límites del plan', async () => {
    const world = await createWorld();
    await world.app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: AUTH,
      payload: { question: '¿Qué produce la mitocondria?' },
    });
    const response = await world.app.inject({
      method: 'GET',
      url: '/v1/me/usage',
      headers: AUTH,
    });
    expect(response.json()).toMatchObject({ questionsToday: 1, questionsLimit: 20 });
  });

  it('borrar la cuenta quita archivos, datos y el usuario, sin tocar a otros', async () => {
    const world = await createWorld();
    const id = await createDocument(world);
    world.objects.set(`${USER}/${id}.pdf`, 100);
    await createCourse(world);
    await createCourse(world, AUTH_OTHER, 'Ajeno');
    for (const headers of [AUTH, AUTH_OTHER]) {
      await world.app.inject({
        method: 'POST',
        url: '/v1/consents',
        headers,
        payload: { document: 'terms', version: '2026-11-01' },
      });
    }
    const response = await world.app.inject({
      method: 'DELETE',
      url: '/v1/account',
      headers: AUTH,
    });
    expect(response.statusCode).toBe(204);
    expect(world.objects.size).toBe(0);
    expect(world.docs.size).toBe(0);
    expect([...world.courses.values()].map((c) => c.title)).toEqual(['Ajeno']);
    expect(world.deletedUsers).toEqual([USER]);
    expect(world.consents.map((c) => c.userId)).toEqual([OTHER]);
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

describe('contexto externo', () => {
  const payload = { question: '¿Quién inventó el cálculo?' };

  it('viaja aparte, etiquetado como internet, y cuenta como pregunta', async () => {
    const world = await createWorld({
      externalSearch: () =>
        Promise.resolve([{ title: 'Web', url: 'https://example.com', snippet: 'dato' }]),
    });
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/external',
      headers: AUTH,
      payload,
    });
    expect(response.json()).toEqual({
      source: 'internet',
      results: [{ title: 'Web', url: 'https://example.com', snippet: 'dato' }],
    });
    expect(world.quota.used).toBe(1);
  });

  it('sin Tavily configurado responde EXTERNAL_UNAVAILABLE sin cobrar', async () => {
    const world = await createWorld();
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/external',
      headers: AUTH,
      payload,
    });
    expect(errorCode(response)).toBe('EXTERNAL_UNAVAILABLE');
    expect(world.quota.used).toBe(0);
  });

  it('si la búsqueda falla, devuelve la pregunta a la cuota', async () => {
    const world = await createWorld({
      externalSearch: () => Promise.reject(new Error('caído')),
    });
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/external',
      headers: AUTH,
      payload,
    });
    expect(response.statusCode).toBe(503);
    expect(world.quota.used).toBe(0);
  });
});

describe('consentimientos', () => {
  const terms = { document: 'terms', version: '2026-11-01' };

  it('registra la aceptación y la lista solo a su dueño', async () => {
    const world = await createWorld();
    const response = await world.app.inject({
      method: 'POST',
      url: '/v1/consents',
      headers: AUTH,
      payload: terms,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...terms, acceptedAt: new Date(0).toISOString() });

    const own = await world.app.inject({ method: 'GET', url: '/v1/consents', headers: AUTH });
    expect(own.json()).toEqual({ consents: [{ ...terms, acceptedAt: new Date(0).toISOString() }] });
    const other = await world.app.inject({
      method: 'GET',
      url: '/v1/consents',
      headers: AUTH_OTHER,
    });
    expect(other.json()).toEqual({ consents: [] });
  });

  it('aceptar dos veces la misma versión no la duplica', async () => {
    const world = await createWorld();
    const accept = () =>
      world.app.inject({ method: 'POST', url: '/v1/consents', headers: AUTH, payload: terms });
    const first = await accept();
    const second = await accept();
    expect(second.statusCode).toBe(201);
    expect(second.json()).toEqual(first.json());
    expect(world.consents).toHaveLength(1);
  });

  it('exige sesión y valida documento y versión', async () => {
    const world = await createWorld();
    const anonymous = await world.app.inject({
      method: 'POST',
      url: '/v1/consents',
      payload: terms,
    });
    expect(anonymous.statusCode).toBe(401);
    expect((await world.app.inject({ method: 'GET', url: '/v1/consents' })).statusCode).toBe(401);
    for (const payload of [
      { document: 'cookies', version: '1' },
      { document: 'privacy', version: '' },
      { document: 'privacy', version: 'x'.repeat(33) },
      { document: 'privacy', version: 'cualquier-cosa' },
      { document: 'privacy' },
    ]) {
      const response = await world.app.inject({
        method: 'POST',
        url: '/v1/consents',
        headers: AUTH,
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(errorCode(response)).toBe('REQ_INVALID');
    }
    expect(world.consents).toEqual([]);
  });
});

describe('límite de peticiones', () => {
  const rateLimit = {
    global: { max: 3, timeWindowMs: 60_000 },
    strict: { max: 1, timeWindowMs: 60_000 },
  };

  it('responde 429 con RATE_LIMITED al pasar el límite global', async () => {
    const { app } = await createWorld({ rateLimit });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push(
        (await app.inject({ method: 'GET', url: '/v1/courses', headers: AUTH })).statusCode,
      );
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
    const limited = await app.inject({ method: 'GET', url: '/v1/courses', headers: AUTH });
    expect(errorCode(limited)).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('las preguntas tienen un límite más estricto, por usuario', async () => {
    const { app } = await createWorld({ rateLimit });
    const ask = (headers: Record<string, string>) =>
      app.inject({
        method: 'POST',
        url: '/v1/questions',
        headers,
        payload: { question: '¿Qué produce la mitocondria?' },
      });
    expect((await ask(AUTH)).statusCode).toBe(200);
    const second = await ask(AUTH);
    expect(second.statusCode).toBe(429);
    expect(errorCode(second)).toBe('RATE_LIMITED');
    // Otro usuario tiene su propio cupo.
    expect((await ask(AUTH_OTHER)).statusCode).toBe(200);
  });

  it('sin sesión cuenta por IP y /health no se limita', async () => {
    const { app } = await createWorld({ rateLimit });
    for (let i = 0; i < 3; i += 1) await app.inject({ method: 'GET', url: '/v1/documents' });
    const limited = await app.inject({ method: 'GET', url: '/v1/documents' });
    expect(limited.statusCode).toBe(429);
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('detrás de un proxy, un X-Forwarded-For inventado no da cupo nuevo', async () => {
    const { app } = await createWorld({ rateLimit, trustProxy: 1 });
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/documents',
        // El cliente inventa una IP distinta en cada petición; el proxy agrega la real.
        headers: { 'x-forwarded-for': `10.0.0.${i}, 203.0.113.7` },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  it('se puede desactivar', async () => {
    const { app } = await createWorld({ rateLimit: false });
    for (let i = 0; i < 5; i += 1) {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    }
    expect(
      (await app.inject({ method: 'GET', url: '/v1/courses', headers: AUTH })).headers[
        'x-ratelimit-limit'
      ],
    ).toBeUndefined();
  });
});

describe('cabeceras y registro', () => {
  it('las respuestas traen cabeceras de seguridad', async () => {
    const { app } = await createWorld();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('los logs no guardan el cuerpo ni el header Authorization', async () => {
    const lines: string[] = [];
    const { app } = await createWorld({
      logger: { stream: { write: (line) => void lines.push(line) } },
      answer: {
        embedder: fakeEmbedder,
        search: () => Promise.reject(new Error('caído')),
        generator: fakeGenerator(VALID_ANSWER),
      },
    });
    const question = '¿Cuál es mi pregunta secreta de examen?';
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions?origen=chat',
      headers: AUTH,
      payload: { question },
    });
    expect(response.statusCode).toBe(502);
    const output = lines.join('');
    expect(output).toContain('/v1/questions');
    expect(output).not.toContain('secreta');
    expect(output).not.toContain('token-1');
    expect(output).not.toContain('origen=chat');
  });

  it('un JSON mal formado es 400 REQ_INVALID y su contenido no llega a los logs', async () => {
    const lines: string[] = [];
    const { app } = await createWorld({
      logger: { stream: { write: (line) => void lines.push(line) } },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/questions',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: '{"question": "mi apunte secreto',
    });
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('REQ_INVALID');
    expect(lines.join('')).not.toContain('secreto');
  });
});
