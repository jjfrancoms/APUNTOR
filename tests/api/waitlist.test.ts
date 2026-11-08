import type { FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import type { AdminAuditRecord } from '../../api/src/admin';
import { buildApp, type AppDeps } from '../../api/src/app';
import { fakeWaitlist } from './helpers';

const ADMIN = '33333333-3333-4333-8333-333333333333';
const USER = '11111111-1111-4111-8111-111111111111';
const AUTH_ADMIN = { authorization: 'Bearer token-admin' };
const AUTH_USER = { authorization: 'Bearer token-user' };
const MISSING = '99999999-9999-4999-8999-999999999999';

async function world(rateLimit: AppDeps['rateLimit'] = false) {
  const waitlist = fakeWaitlist();
  const audit: Omit<AdminAuditRecord, 'id' | 'createdAt'>[] = [];
  // Solo lo que usan estas rutas: el resto de dependencias no se toca.
  const deps = {
    authenticate: (token: string) =>
      Promise.resolve(
        token === 'token-admin'
          ? { userId: ADMIN, email: 'admin@example.com' }
          : token === 'token-user'
            ? { userId: USER, email: 'alumno@example.com' }
            : null,
      ),
    waitlist,
    adminEmails: ['admin@example.com'],
    authUsers: {
      list: () => Promise.resolve({ users: [], total: 0 }),
      get: (id: string) =>
        Promise.resolve(
          id === ADMIN ? { id, email: 'admin@example.com', emailConfirmedAt: new Date(0) } : null,
        ),
    },
    admin: {
      recordAudit(entry: Omit<AdminAuditRecord, 'id' | 'createdAt'>) {
        audit.push(entry);
        return Promise.resolve();
      },
    },
    rateLimit,
  } as unknown as AppDeps;
  const app = await buildApp(deps);
  return { app, waitlist, audit };
}

function join(app: FastifyInstance, payload: Record<string, unknown>, remoteAddress?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/waitlist',
    payload,
    ...(remoteAddress === undefined ? {} : { remoteAddress }),
  });
}

const VALID = { email: ' Tutor@Example.com ', consent: true };

describe('POST /v1/waitlist', () => {
  it('no pide sesión y guarda el correo normalizado con su consentimiento', async () => {
    const { app, waitlist } = await world();
    const response = await join(app, { ...VALID, source: 'web' });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: 'joined' });
    expect(waitlist.entries).toMatchObject([
      { email: 'tutor@example.com', consent: true, source: 'web' },
    ]);
  });

  it('es idempotente por correo y responde igual: no revela quién está inscrito', async () => {
    const { app, waitlist } = await world();
    const first = await join(app, VALID);
    const second = await join(app, { ...VALID, email: 'TUTOR@example.com' });
    expect(second.statusCode).toBe(first.statusCode);
    expect(second.json()).toEqual(first.json());
    expect(waitlist.entries).toHaveLength(1);
  });

  it.each([
    ['sin consentimiento', { email: 'a@example.com' }],
    ['consentimiento en falso', { email: 'a@example.com', consent: false }],
    ['correo inválido', { email: 'no-es-correo', consent: true }],
    ['correo enorme', { email: `${'a'.repeat(260)}@example.com`, consent: true }],
    ['origen desconocido', { email: 'a@example.com', consent: true, source: 'bot' }],
  ])('rechaza %s sin guardar nada', async (_name, payload) => {
    const { app, waitlist } = await world();
    const response = await join(app, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: { code: 'REQ_INVALID' } });
    expect(waitlist.entries).toHaveLength(0);
  });

  it('tiene un límite estricto por IP, aparte del global', async () => {
    const { app } = await world({
      global: { max: 100, timeWindowMs: 60_000 },
      strict: { max: 100, timeWindowMs: 60_000 },
      waitlist: { max: 2, timeWindowMs: 60_000 },
    });
    for (const email of ['a@example.com', 'b@example.com']) {
      expect((await join(app, { email, consent: true }, '10.0.0.1')).statusCode).toBe(201);
    }
    const blocked = await join(app, { email: 'c@example.com', consent: true }, '10.0.0.1');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ error: { code: 'RATE_LIMITED' } });
    // Otra IP sigue teniendo su cupo.
    expect(
      (await join(app, { email: 'c@example.com', consent: true }, '10.0.0.2')).statusCode,
    ).toBe(201);
  });
});

describe('lista de espera en el panel', () => {
  it('exige sesión de administrador', async () => {
    const { app } = await world();
    expect((await app.inject({ url: '/v1/admin/waitlist' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/v1/admin/waitlist', headers: AUTH_USER })).statusCode).toBe(
      403,
    );
    const asUser = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/waitlist/${MISSING}`,
      headers: AUTH_USER,
    });
    expect(asUser.statusCode).toBe(403);
  });

  it('lista paginada con correo, fecha, origen y consentimiento', async () => {
    const { app } = await world();
    await join(app, { email: 'a@example.com', consent: true });
    await join(app, { email: 'b@example.com', consent: true });
    const response = await app.inject({
      url: '/v1/admin/waitlist?page=1&perPage=1',
      headers: AUTH_ADMIN,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ entries: unknown[]; hasMore: boolean }>();
    expect(body.hasMore).toBe(true);
    expect(body.entries).toEqual([
      {
        id: expect.any(String) as string,
        email: 'b@example.com',
        consent: true,
        source: 'app',
        createdAt: new Date(0).toISOString(),
      },
    ]);
  });

  it('borra una inscripción y audita solo su id, nunca el correo', async () => {
    const { app, waitlist, audit } = await world();
    await join(app, { email: 'a@example.com', consent: true });
    const id = waitlist.entries[0]?.id ?? '';
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/waitlist/${id}`,
      headers: AUTH_ADMIN,
    });
    expect(response.statusCode).toBe(204);
    expect(waitlist.entries).toHaveLength(0);
    expect(audit).toMatchObject([{ action: 'waitlist.delete', target: `waitlist:${id}` }]);
    expect(JSON.stringify(audit)).not.toContain('a@example.com');
  });

  it('una inscripción que ya no existe es 404', async () => {
    const { app, audit } = await world();
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/waitlist/${MISSING}`,
      headers: AUTH_ADMIN,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'WAITLIST_NOT_FOUND' } });
    expect(audit).toHaveLength(0);
  });
});
