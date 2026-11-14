/**
 * Decisión de enrutado de la web publicada (Cloudflare Workers + archivos estáticos).
 *
 * Función pura: recibe host, ruta y query y devuelve qué hacer. `index.ts` la aplica.
 * Tres tipos de contenido conviven en apuntor.com:
 *  - páginas públicas e indexables (landing y textos legales), HTML estático;
 *  - la app (Expo exportada como SPA): rutas conocidas, siempre con `noindex`;
 *  - archivos estáticos (`/_expo/*`, `/assets/*`, robots.txt, sitemap.xml…).
 * Todo lo demás es un 404 real: no se cae a la SPA.
 */

/** Dominio canónico: `www` redirige aquí. */
export const CANONICAL_HOST = 'apuntor.com';
export const WWW_HOST = 'www.apuntor.com';

/** Archivo de la landing dentro de `dist/` (no es `index.html`, que es la SPA). */
export const LANDING_FILE = '/landing.html';
export const SPA_FILE = '/index.html';
export const NOT_FOUND_FILE = '/404.html';

/** Páginas públicas estáticas: ruta → archivo en `dist/`. Se generan desde `i18n/legal.ts`. */
export const PUBLIC_PAGES: Readonly<Record<string, string>> = {
  '/legal/privacy': '/legal/privacy.html',
  '/legal/terms': '/legal/terms.html',
};

/**
 * Rutas de la app, derivadas de `src/app/**` (sin grupos `(auth)`/`(tabs)` y sin `+not-found`).
 * `:param` es un segmento dinámico (`[param].tsx`). Un test las compara con las carpetas reales.
 * La raíz `/` no está: en web es la landing.
 */
export const APP_ROUTES: readonly string[] = [
  // (auth)
  '/auth-callback',
  '/confirm-age',
  '/forgot-password',
  '/link-sent',
  '/login',
  '/notifications-permission',
  '/onboarding',
  '/privacy',
  '/register',
  '/reset-password',
  // (tabs)
  '/chat',
  '/courses',
  '/courses/:courseId',
  '/courses/class/:classId',
  '/courses/search',
  '/courses/topics/:topicId',
  '/home',
  '/profile',
  '/profile/contact',
  '/profile/delete-account',
  '/profile/edit',
  '/profile/help',
  '/profile/notifications',
  '/profile/subscription',
  // resto
  '/admin',
  '/admin/audit',
  '/admin/documents',
  '/admin/users',
  '/conversation',
  '/conversation/error',
  '/conversation/offline',
  '/conversation/outside',
  '/conversation/responding',
  '/documents/:documentId',
  '/legal/:doc',
  '/mapa',
  '/plans',
  '/s/:token',
  '/study/flashcards',
  '/study/quiz-setup',
  '/study/quiz',
  '/study/review',
  '/topic',
  '/upload',
  '/upload/errors',
  '/upload/language',
  '/upload/problems',
  '/upload/progress',
  '/upload/review',
  '/upload/scan-review',
  '/upload/scan',
  '/waitlist',
];

/** Prefijos que siempre son archivos estáticos generados por Expo. */
const STATIC_PREFIXES: readonly string[] = ['/_expo/', '/assets/'];

export interface RouteInput {
  hostname: string;
  pathname: string;
  /** Con el `?` inicial, o vacío. */
  search: string;
}

export type RouteDecision =
  | { kind: 'redirect'; status: 301 | 302; location: string }
  /** Sirve este archivo de `dist/`. `noindex` añade `X-Robots-Tag: noindex`. */
  | { kind: 'file'; path: string; noindex: boolean }
  /** Pasa la petición tal cual a los archivos estáticos; si no existe, 404. */
  | { kind: 'static' }
  | { kind: 'not-found' };

function matchesPattern(pattern: string, pathname: string): boolean {
  const want = pattern.split('/');
  const got = pathname.split('/');
  if (want.length !== got.length) return false;
  return want.every((segment, i) => {
    const actual = got[i] ?? '';
    return segment.startsWith(':') ? actual.length > 0 : segment === actual;
  });
}

/** true si la ruta es una pantalla de la app (incluidas las dinámicas). */
export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((pattern) => matchesPattern(pattern, pathname));
}

/** El proveedor de acceso devolvió al usuario a la raíz con un código o un error. */
function isAuthReturn(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('code') || params.has('error') || params.has('error_code');
}

export function decideRoute({ hostname, pathname, search }: RouteInput): RouteDecision {
  if (hostname.toLowerCase() === WWW_HOST) {
    return {
      kind: 'redirect',
      status: 301,
      location: `https://${CANONICAL_HOST}${pathname}${search}`,
    };
  }

  if (pathname === '/') {
    // Red de seguridad: si el regreso de Google/correo cae en la raíz, la app lo termina.
    if (isAuthReturn(search)) {
      return { kind: 'redirect', status: 302, location: `/auth-callback${search}` };
    }
    return { kind: 'file', path: LANDING_FILE, noindex: false };
  }

  // Una sola forma de cada URL: sin barra final (y sin bucles: la destino nunca la lleva).
  if (pathname.endsWith('/')) {
    const clean = pathname.replace(/\/+$/, '') || '/';
    return { kind: 'redirect', status: 301, location: `${clean}${search}` };
  }

  // Los .html internos no se exponen: la landing y las páginas viven en sus rutas limpias.
  if (pathname.endsWith('.html')) return { kind: 'not-found' };

  const page = PUBLIC_PAGES[pathname];
  if (page !== undefined) return { kind: 'file', path: page, noindex: false };

  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return { kind: 'static' };

  if (isAppRoute(pathname)) return { kind: 'file', path: SPA_FILE, noindex: true };

  // Archivos con extensión (robots.txt, sitemap.xml, favicon…): si no existen, 404.
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (last.includes('.')) return { kind: 'static' };

  return { kind: 'not-found' };
}
