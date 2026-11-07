import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authHasMore,
  countAuthUsers,
  createAdminGate,
  createSupabaseUsersDirectory,
  isAdminEmail,
  parseAdminEmails,
  type AuthUserIdentity,
  type AuthUsersDirectory,
} from '../../api/src/admin';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ADMIN_EMAILS', () => {
  it('separa por comas, quita espacios y compara sin mayúsculas', () => {
    const admins = new Set(parseAdminEmails(' Ana@Example.com, ,beto@example.com '));
    expect([...admins]).toEqual(['ana@example.com', 'beto@example.com']);
    expect(isAdminEmail(admins, 'ANA@example.COM')).toBe(true);
    expect(isAdminEmail(admins, 'otro@example.com')).toBe(false);
    expect(isAdminEmail(admins, null)).toBe(false);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

describe('verificación del administrador', () => {
  const ID = '33333333-3333-4333-8333-333333333333';
  const confirmed = { id: ID, email: 'admin@example.com', emailConfirmedAt: new Date(0) };

  it('exige claim en la lista, correo confirmado y el mismo correo en la Admin API', async () => {
    const answers = new Map<string, AuthUserIdentity | null>([
      ['ok', confirmed],
      ['sin-confirmar', { ...confirmed, emailConfirmedAt: null }],
      ['otro', { ...confirmed, email: 'otro@example.com' }],
      ['no-existe', null],
    ]);
    for (const [name, answer] of answers) {
      const gate = createAdminGate({
        adminEmails: ['Admin@example.com'],
        directory: { get: () => Promise.resolve(answer) },
      });
      const result = await gate.check({ userId: ID, email: 'ADMIN@example.com' });
      expect([name, result]).toEqual([name, name === 'ok' ? 'admin@example.com' : null]);
    }
  });

  it('cachea por usuario durante el TTL y no consulta si el claim no está en la lista', async () => {
    let now = 0;
    const lookups: string[] = [];
    const gate = createAdminGate({
      adminEmails: ['admin@example.com'],
      directory: {
        get: (id) => {
          lookups.push(id);
          return Promise.resolve(confirmed);
        },
      },
      ttlMs: 1000,
      now: () => now,
    });
    expect(await gate.check({ userId: ID, email: 'otro@example.com' })).toBeNull();
    expect(await gate.check({ userId: ID, email: null })).toBeNull();
    expect(lookups).toEqual([]);
    await gate.check({ userId: ID, email: 'admin@example.com' });
    now = 999;
    await gate.check({ userId: ID, email: 'admin@example.com' });
    expect(lookups).toEqual([ID]);
    now = 1000;
    await gate.check({ userId: ID, email: 'admin@example.com' });
    expect(lookups).toEqual([ID, ID]);
  });
});

describe('usuarios de Supabase Auth', () => {
  it('lee la Admin API con la service role key y traduce los campos', async () => {
    const calls: { url: string; headers: Headers }[] = [];
    // Servicio simulado: ninguna petición sale a Supabase.
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      calls.push({ url, headers: new Headers(init.headers) });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            users: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                email: 'ana@example.com',
                created_at: '2026-11-01T10:00:00Z',
                last_sign_in_at: null,
                app_metadata: { provider: 'google' },
                user_metadata: { full_name: 'no se expone' },
              },
            ],
            aud: 'authenticated',
          }),
          { status: 200, headers: { 'x-total-count': '7' } },
        ),
      );
    });
    const directory = createSupabaseUsersDirectory('https://demo.supabase.co/', 'service-key');
    const result = await directory.list(2, 5);
    expect(calls[0]?.url).toBe('https://demo.supabase.co/auth/v1/admin/users?page=2&per_page=5');
    expect(calls[0]?.headers.get('apikey')).toBe('service-key');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer service-key');
    expect(result).toEqual({
      total: 7,
      users: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'ana@example.com',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          lastSignInAt: null,
          provider: 'google',
        },
      ],
    });
  });

  it('lee una cuenta por id con su confirmación de correo; 404 → null', async () => {
    const calls: { url: string; headers: Headers }[] = [];
    const id = '11111111-1111-4111-8111-111111111111';
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      calls.push({ url, headers: new Headers(init.headers) });
      if (url.endsWith('/missing')) {
        return Promise.resolve(new Response('{"msg":"User not found"}', { status: 404 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id,
            email: 'ana@example.com',
            email_confirmed_at: url.includes(id) ? '2026-11-01T10:00:00Z' : null,
          }),
          { status: 200 },
        ),
      );
    });
    const directory = createSupabaseUsersDirectory('https://demo.supabase.co/', 'service-key');
    expect(await directory.get(id)).toEqual({
      id,
      email: 'ana@example.com',
      emailConfirmedAt: new Date('2026-11-01T10:00:00Z'),
    });
    expect(calls[0]?.url).toBe(`https://demo.supabase.co/auth/v1/admin/users/${id}`);
    expect(calls[0]?.headers.get('apikey')).toBe('service-key');
    expect(await directory.get('missing')).toBeNull();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 500 })));
    await expect(directory.get(id)).rejects.toThrow('HTTP 500');
  });

  it('falla si Supabase responde con error', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 401 })));
    const directory = createSupabaseUsersDirectory('https://demo.supabase.co', 'k');
    await expect(directory.list(1, 1)).rejects.toThrow('HTTP 401');
  });

  it('hasMore usa el total y, sin él, si la página vino llena', () => {
    expect(authHasMore({ users: [], total: 10 }, 2, 5)).toBe(false);
    expect(authHasMore({ users: [], total: 11 }, 2, 5)).toBe(true);
    const full = Array.from({ length: 2 }, () => ({
      id: 'x',
      email: null,
      createdAt: new Date(0),
      lastSignInAt: null,
      provider: 'email',
    }));
    expect(authHasMore({ users: full, total: null }, 1, 2)).toBe(true);
    expect(authHasMore({ users: full.slice(1), total: null }, 1, 2)).toBe(false);
  });

  it('sin total informado, cuenta recorriendo las páginas', async () => {
    const all = Array.from({ length: 1500 }, (_, i) => ({
      id: String(i),
      email: null,
      createdAt: new Date(0),
      lastSignInAt: null,
      provider: 'email',
    }));
    const directory: Pick<AuthUsersDirectory, 'list'> = {
      list: (page, perPage) =>
        Promise.resolve({ users: all.slice((page - 1) * perPage, page * perPage), total: null }),
    };
    expect(await countAuthUsers(directory)).toBe(1500);
    expect(await countAuthUsers({ list: () => Promise.resolve({ users: [], total: 42 }) })).toBe(
      42,
    );
  });
});
