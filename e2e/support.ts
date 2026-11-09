/**
 * Soporte común de los tests: servidor falso de Supabase y de la API de APUNTOR, sesiones
 * inyectadas y la red de seguridad que hace FALLAR el test si algo intenta salir a un servicio real.
 */
import { test as base, expect, type BrowserContext, type Route } from '@playwright/test';
import {
  ANSWER,
  CARDS,
  CONSENTS_CURRENT,
  COURSE,
  DOCUMENT,
  EXPORT_DATA,
  FAKE_API_URL,
  FAKE_SUPABASE_URL,
  PASSWORD_OK,
  QUIZ,
  SEARCH_RESULTS,
  TOPIC_SUMMARY,
  TOPICS,
  USAGE,
  USER,
} from './fixtures';

export { expect };

const API_HOST = new URL(FAKE_API_URL).host;
const SUPABASE_HOST = new URL(FAKE_SUPABASE_URL).host;

/** Cuerpo JSON de una petición, ya interpretado. */
export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export interface Reply {
  status?: number;
  json?: unknown;
}

export type Handler = (request: RecordedRequest) => Reply | Promise<Reply>;

export type UserKind = 'email' | 'google';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
};

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** Clave donde supabase-js guarda la sesión: `sb-<primera parte del host>-auth-token`. */
export const SESSION_STORAGE_KEY = `sb-${new URL(FAKE_SUPABASE_URL).hostname.split('.')[0] ?? ''}-auth-token`;

/** Usuario de Supabase: con correo y contraseña, o solo con Google (sin contraseña propia). */
function supabaseUser(kind: UserKind) {
  const provider = kind === 'email' ? 'email' : 'google';
  return {
    id: USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: USER.email,
    app_metadata: { provider, providers: [provider] },
    // La confirmación de mayoría de edad lleva directo a Inicio.
    user_metadata: { full_name: USER.fullName, level: 'university', adult_confirmed: true },
    created_at: '2026-10-01T10:00:00.000Z',
  };
}

/** Sesión no vencida (24 horas) con un token con forma de JWT, pero falso. */
export function fakeSession(kind: UserKind) {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600;
  const accessToken = [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: USER.id, role: 'authenticated', exp: expiresAt }),
    'firma-falsa',
  ].join('.');
  return {
    access_token: accessToken,
    refresh_token: 'refresco-falso',
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    user: supabaseUser(kind),
  };
}

export class Mock {
  /** Todas las peticiones a los hosts falsos, en orden. */
  readonly requests: RecordedRequest[] = [];
  /** Intentos de salir a hosts que no son locales ni `.e2e.test`: deben ser cero. */
  readonly forbidden: string[] = [];
  /** Respuesta de `GET /v1/consents`; cada test puede cambiarla. */
  consents: unknown = CONSENTS_CURRENT;
  private readonly overrides = new Map<string, Handler>();
  private kind: UserKind = 'email';

  constructor(private readonly context: BrowserContext) {}

  /** Sustituye la respuesta por defecto de `METODO /ruta`. */
  on(method: string, path: string, handler: Handler): void {
    this.overrides.set(`${method} ${path}`, handler);
  }

  /** Peticiones registradas a `METODO /ruta`. */
  calls(method: string, path: string): RecordedRequest[] {
    return this.requests.filter((r) => r.method === method && r.path === path);
  }

  /** Inicia sesión como ese usuario antes de que cargue la app (sin tocar Supabase). */
  async signIn(kind: UserKind): Promise<void> {
    this.kind = kind;
    await this.context.addInitScript(
      ([key, value]) => {
        // Solo si no hay sesión: así no pisa una que la app haya renovado o cerrado.
        if (!localStorage.getItem(key)) localStorage.setItem(key, value);
      },
      [SESSION_STORAGE_KEY, JSON.stringify(fakeSession(kind))] as const,
    );
  }

  /** Instala la red falsa y la red de seguridad en todo el contexto del navegador. */
  async install(): Promise<void> {
    await this.context.route('**/*', (route) => this.handle(route));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (local) return route.continue();
    if (url.host !== API_HOST && url.host !== SUPABASE_HOST) {
      // Cualquier otro host: se bloquea y el test falla al terminar.
      this.forbidden.push(`${request.method()} ${request.url()}`);
      return route.abort('blockedbyclient');
    }
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS });
    }
    const raw = request.postData();
    let body: unknown = raw;
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    }
    const recorded: RecordedRequest = {
      method: request.method(),
      path: url.pathname,
      query: url.searchParams,
      body,
    };
    this.requests.push(recorded);
    const reply = url.host === SUPABASE_HOST ? this.auth(recorded) : await this.api(recorded);
    try {
      if (reply.status === 204 || reply.json === undefined) {
        await route.fulfill({ status: reply.status ?? 204, headers: CORS });
      } else {
        await route.fulfill({
          status: reply.status ?? 200,
          headers: CORS,
          contentType: 'application/json',
          body: JSON.stringify(reply.json),
        });
      }
    } catch {
      // La app canceló la petición (por ejemplo "Detener") antes de recibir la respuesta.
    }
  }

  private auth(r: RecordedRequest): Reply {
    if (r.path === '/auth/v1/token') {
      const grant = r.query.get('grant_type');
      const password = (r.body as { password?: unknown } | null)?.password;
      if (grant === 'password' && password !== PASSWORD_OK) {
        return {
          status: 400,
          json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
        };
      }
      return { json: fakeSession(this.kind) };
    }
    if (r.path === '/auth/v1/user') return { json: supabaseUser(this.kind) };
    if (r.path === '/auth/v1/logout') return { status: 204 };
    return { status: 404, json: { msg: 'No existe en el Supabase falso' } };
  }

  private async api(r: RecordedRequest): Promise<Reply> {
    const override = this.overrides.get(`${r.method} ${r.path}`);
    if (override) return override(r);
    const key = `${r.method} ${r.path}`;
    switch (key) {
      case 'GET /health':
        return { json: { status: 'ok' } };
      case 'GET /v1/me/usage':
        return { json: USAGE };
      case 'GET /v1/courses':
        return { json: { courses: [COURSE] } };
      case 'GET /v1/documents':
        return { json: { documents: [DOCUMENT] } };
      case 'GET /v1/consents':
        return { json: this.consents };
      case 'GET /v1/search':
        return { json: SEARCH_RESULTS };
      case 'GET /v1/account/export':
        return { json: EXPORT_DATA };
      case 'DELETE /v1/account':
        return { status: 204 };
      case 'GET /v1/admin/me':
        return { status: 403, json: { error: { code: 'FORBIDDEN' } } };
      case 'POST /v1/questions':
        return { json: ANSWER };
      default:
    }
    const conversation = this.conversations(r);
    if (conversation) return conversation;
    const study = this.study(r);
    if (study) return study;
    if (r.method === 'GET' && r.path === `/v1/documents/${DOCUMENT.id}`) return { json: DOCUMENT };
    if (r.method === 'GET' && r.path === `/v1/documents/${DOCUMENT.id}/topics`) {
      return { json: { topics: TOPICS } };
    }
    if (r.method === 'GET' && r.path.endsWith('/summary')) return { json: TOPIC_SUMMARY };
    return { status: 404, json: { error: { code: 'NOT_FOUND' } } };
  }

  /** Sincronización de conversaciones: el servidor falso no guarda nada, solo confirma. */
  private conversations(r: RecordedRequest): Reply | null {
    if (!r.path.startsWith('/v1/conversations')) return null;
    const body = (r.body ?? {}) as Record<string, unknown>;
    const id = r.path.split('/')[3] ?? '';
    const summary = { title: '', course: '', scopeDocumentIds: null, ...body, id, messageCount: 0 };
    const stamp = { createdAt: '2026-11-08T10:00:00.000Z', updatedAt: '2026-11-08T10:00:00.000Z' };
    if (r.method === 'GET' && r.path === '/v1/conversations') {
      return { json: { conversations: [], page: 1, hasMore: false } };
    }
    if (r.method === 'DELETE') return { status: 204 };
    if (r.method === 'POST' && r.path === '/v1/conversations') {
      return { status: 201, json: { ...stamp, ...summary, id: body.id } };
    }
    return { json: { ...stamp, ...summary } };
  }

  /** Quizzes, tarjetas y repaso: siempre el mismo juego de una pregunta o una tarjeta. */
  private study(r: RecordedRequest): Reply | null {
    if (!r.path.startsWith('/v1/study/')) return null;
    const kind = (r.body as { kind?: unknown } | null)?.kind;
    if (r.method === 'POST' && r.path === '/v1/study/sets') {
      return { status: 201, json: kind === 'cards' ? CARDS : QUIZ };
    }
    if (r.method === 'GET' && r.path === '/v1/study/sets') return { json: { sets: [] } };
    if (r.method === 'GET' && r.path === '/v1/study/review/today') return { json: { items: [] } };
    if (r.method === 'GET' && r.path.startsWith('/v1/study/sets/')) {
      return { json: r.path.endsWith(CARDS.set.id) ? CARDS : QUIZ };
    }
    if (r.method === 'DELETE') return { status: 204 };
    if (r.method === 'POST' && r.path.endsWith('/review')) {
      return { json: { id: r.path.split('/')[4], box: 1, dueDate: '2026-11-09' } };
    }
    if (r.method === 'POST' && r.path.endsWith('/results')) return { json: { ok: true } };
    return null;
  }
}

/** `test` con el servidor falso y la red de seguridad activos en todos los tests. */
export const test = base.extend<{ mock: Mock }>({
  mock: [
    async ({ context }, use) => {
      const mock = new Mock(context);
      await mock.install();
      await use(mock);
      // Red de seguridad: salir a un servicio real hace fallar el test.
      expect(mock.forbidden, 'peticiones a hosts no permitidos').toEqual([]);
    },
    { auto: true },
  ],
});
