import type { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from '../../api/src/app';
import { fakeConversations } from './helpers';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const AUTH = { authorization: 'Bearer token-a' };
const AUTH_OTHER = { authorization: 'Bearer token-b' };
const CONV = 'cccccccc-0000-4000-8000-000000000001';
const MSG_1 = 'dddddddd-0000-4000-8000-000000000001';
const MSG_2 = 'dddddddd-0000-4000-8000-000000000002';
const SECRET = 'TEXTO-PRIVADO-DE-LA-PREGUNTA';

let app: FastifyInstance;
let repository: ReturnType<typeof fakeConversations>;
let logs: string[];

function unused(): never {
  throw new Error('No debería llamarse');
}

beforeEach(async () => {
  repository = fakeConversations();
  logs = [];
  const unusedDep = new Proxy({}, { get: () => unused }) as never;
  const deps: AppDeps = {
    authenticate: (token) =>
      Promise.resolve(
        token === 'token-a'
          ? { userId: USER, email: null }
          : token === 'token-b'
            ? { userId: OTHER, email: null }
            : null,
      ),
    documents: unusedDep,
    consents: unusedDep,
    conversations: repository,
    waitlist: unusedDep,
    accountExport: unusedDep,
    contentSearch: unusedDep,
    storage: unusedDep,
    enqueue: unused,
    quota: unusedDep,
    answer: unusedDep,
    deleteAuthUser: unused,
    admin: unusedDep,
    authUsers: unusedDep,
    logger: {
      stream: {
        write(line) {
          logs.push(line);
        },
      },
    },
    rateLimit: false,
  };
  app = await buildApp(deps);
});

function create(headers = AUTH) {
  return app.inject({
    method: 'POST',
    url: '/v1/conversations',
    headers,
    payload: { id: CONV, title: SECRET, updatedAt: '2026-11-01T10:00:00.000Z' },
  });
}

function append(ids: string[], headers = AUTH) {
  return app.inject({
    method: 'POST',
    url: `/v1/conversations/${CONV}/messages`,
    headers,
    payload: {
      messages: ids.map((id) => ({
        id,
        role: 'user',
        kind: 'answer',
        text: SECRET,
        payload: { sources: [{ page: 2, klass: 0, documentId: 'd1' }], invented: 'fuera' },
      })),
    },
  });
}

describe('/v1/conversations', () => {
  it('exige sesión en todas las rutas', async () => {
    const urls = [
      ['GET', '/v1/conversations'],
      ['GET', `/v1/conversations/${CONV}`],
      ['POST', '/v1/conversations'],
      ['PATCH', `/v1/conversations/${CONV}`],
      ['POST', `/v1/conversations/${CONV}/messages`],
      ['POST', `/v1/conversations/${CONV}/messages/delete`],
      ['DELETE', `/v1/conversations/${CONV}`],
    ] as const;
    for (const [method, url] of urls) {
      expect((await app.inject({ method, url })).statusCode).toBe(401);
    }
  });

  it('crear es idempotente por id y no pisa lo que ya existe', async () => {
    expect((await create()).statusCode).toBe(201);
    const again = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: AUTH,
      payload: { id: CONV, title: 'Otro título' },
    });
    expect(again.statusCode).toBe(201);
    expect(again.json()).toMatchObject({ id: CONV, title: SECRET });
    expect(repository.rows).toHaveLength(1);
  });

  it('el id de una conversación ajena responde como si no existiera', async () => {
    await create();
    expect((await create(AUTH_OTHER)).statusCode).toBe(404);
    const read = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${CONV}`,
      headers: AUTH_OTHER,
    });
    expect(read.statusCode).toBe(404);
    expect((await append([MSG_1], AUTH_OTHER)).statusCode).toBe(404);
    const stranger = await app.inject({
      method: 'DELETE',
      url: `/v1/conversations/${CONV}`,
      headers: AUTH_OTHER,
    });
    expect(stranger.statusCode).toBe(204);
    expect(repository.rows).toHaveLength(1);
  });

  it('agrega mensajes sin duplicar al reenviar y descarta campos desconocidos', async () => {
    await create();
    expect((await append([MSG_1, MSG_2])).json()).toMatchObject({ messageCount: 2 });
    expect((await append([MSG_1, MSG_2])).json()).toMatchObject({ messageCount: 2 });
    const detail = await app.inject({
      method: 'GET',
      url: `/v1/conversations/${CONV}`,
      headers: AUTH,
    });
    const body = detail.json<{ messages: { id: string; payload: Record<string, unknown> }[] }>();
    expect(body.messages.map((m) => m.id)).toEqual([MSG_1, MSG_2]);
    expect(body.messages[0]?.payload).toEqual({
      sources: [{ page: 2, klass: 0, documentId: 'd1' }],
    });
  });

  it('valida el cuerpo: tipo de mensaje, ids y tamaño del lote', async () => {
    await create();
    const invalid = (payload: object, url = `/v1/conversations/${CONV}/messages`) =>
      app.inject({ method: 'POST', url, headers: AUTH, payload });
    const message = { id: MSG_1, role: 'user', kind: 'text', text: 'x' };
    expect((await invalid({ messages: [] })).statusCode).toBe(400);
    expect((await invalid({ messages: [{ ...message, kind: 'otro' }] })).statusCode).toBe(400);
    expect((await invalid({ messages: [{ ...message, role: 'admin' }] })).statusCode).toBe(400);
    expect((await invalid({ messages: [{ ...message, id: 'no-uuid' }] })).statusCode).toBe(400);
    expect(
      (await invalid({ messages: Array.from({ length: 101 }, () => message) })).statusCode,
    ).toBe(400);
    const badDelete = await invalid({ ids: ['x'] }, `/v1/conversations/${CONV}/messages/delete`);
    expect(badDelete.statusCode).toBe(400);
  });

  it('un lote con varias respuestas largas cabe aunque supere los 64 KB generales', async () => {
    await create();
    const response = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${CONV}/messages`,
      headers: AUTH,
      payload: {
        messages: Array.from({ length: 10 }, (_, i) => ({
          id: `dddddddd-0000-4000-8000-00000000010${i}`,
          role: 'mascot',
          kind: 'answer',
          text: 'a'.repeat(15_000),
        })),
      },
    });
    expect(response.statusCode).toBe(200);
  });

  it('quita mensajes (editar la última pregunta) y renombra', async () => {
    await create();
    await append([MSG_1, MSG_2]);
    const removed = await app.inject({
      method: 'POST',
      url: `/v1/conversations/${CONV}/messages/delete`,
      headers: AUTH,
      payload: { ids: [MSG_2] },
    });
    expect(removed.json()).toMatchObject({ messageCount: 1 });
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/v1/conversations/${CONV}`,
      headers: AUTH,
      payload: { title: 'Nuevo', course: 'Cálculo' },
    });
    expect(renamed.json()).toMatchObject({ title: 'Nuevo', course: 'Cálculo' });
    const empty = await app.inject({
      method: 'PATCH',
      url: `/v1/conversations/${CONV}`,
      headers: AUTH,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
  });

  it('lista por página, la más reciente primero, y borra', async () => {
    for (let i = 0; i < 3; i += 1) {
      await app.inject({
        method: 'POST',
        url: '/v1/conversations',
        headers: AUTH,
        payload: {
          id: `cccccccc-0000-4000-8000-00000000000${i + 2}`,
          title: `C${i}`,
          updatedAt: `2026-11-0${i + 1}T00:00:00Z`,
        },
      });
    }
    const first = await app.inject({
      method: 'GET',
      url: '/v1/conversations?perPage=2',
      headers: AUTH,
    });
    const body = first.json<{ conversations: { title: string }[]; hasMore: boolean }>();
    expect(body.conversations.map((c) => c.title)).toEqual(['C2', 'C1']);
    expect(body.hasMore).toBe(true);
    const deleted = await app.inject({
      method: 'DELETE',
      url: '/v1/conversations/cccccccc-0000-4000-8000-000000000002',
      headers: AUTH,
    });
    expect(deleted.statusCode).toBe(204);
    expect(repository.rows).toHaveLength(2);
  });

  it('nunca escribe títulos ni mensajes en los logs', async () => {
    await create();
    await append([MSG_1]);
    await app.inject({ method: 'GET', url: `/v1/conversations/${CONV}`, headers: AUTH });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join('\n')).not.toContain(SECRET);
  });
});
