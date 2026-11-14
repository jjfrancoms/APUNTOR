import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_ROUTES,
  LANDING_FILE,
  NOT_FOUND_FILE,
  PUBLIC_PAGES,
  SPA_FILE,
  decideRoute,
  isAppRoute,
  type RouteDecision,
} from '../worker/routing';

const APEX = 'apuntor.com';

function route(pathname: string, search = '', hostname = APEX): RouteDecision {
  return decideRoute({ hostname, pathname, search });
}

/** Rutas de `src/app/**` como patrones (`/courses/:courseId`), sin grupos ni `+not-found`. */
function routesFromFiles(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      const segment = name.startsWith('(') ? '' : `/${name}`;
      found.push(...routesFromFiles(full, `${prefix}${segment}`));
      continue;
    }
    const base = name.replace(/\.tsx?$/, '');
    if (base.startsWith('_') || base.startsWith('+')) continue;
    if (base === 'index') {
      if (prefix !== '') found.push(prefix);
      continue;
    }
    found.push(`${prefix}/${base.replace(/^\[(.+)\]$/, ':$1')}`);
  }
  return found;
}

describe('enrutado de la web', () => {
  it('APP_ROUTES coincide con las pantallas de src/app (la raíz es la landing)', () => {
    const real = routesFromFiles(path.resolve(__dirname, '../src/app'));
    expect([...APP_ROUTES].sort()).toEqual([...real].sort());
  });

  it('www redirige con 301 al dominio sin www conservando ruta y query', () => {
    expect(route('/', '', 'www.apuntor.com')).toEqual({
      kind: 'redirect',
      status: 301,
      location: 'https://apuntor.com/',
    });
    expect(route('/legal/privacy', '?a=1', 'www.apuntor.com')).toEqual({
      kind: 'redirect',
      status: 301,
      location: 'https://apuntor.com/legal/privacy?a=1',
    });
    expect(route('/login', '', 'WWW.Apuntor.com').kind).toBe('redirect');
  });

  it('la raíz sirve la landing, indexable', () => {
    expect(route('/')).toEqual({ kind: 'file', path: LANDING_FILE, noindex: false });
  });

  it('si el regreso de acceso cae en la raíz, la app lo termina en auth-callback', () => {
    expect(route('/', '?code=abc&state=x')).toEqual({
      kind: 'redirect',
      status: 302,
      location: '/auth-callback?code=abc&state=x',
    });
    expect(route('/', '?error=access_denied').kind).toBe('redirect');
    expect(route('/', '?utm_source=x').kind).toBe('file');
  });

  it('las páginas legales públicas se sirven sin redirecciones', () => {
    for (const [url, file] of Object.entries(PUBLIC_PAGES)) {
      expect(route(url)).toEqual({ kind: 'file', path: file, noindex: false });
    }
  });

  it('la barra final se quita con 301 y el destino no vuelve a redirigir', () => {
    const first = route('/legal/privacy/', '?x=1');
    expect(first).toEqual({ kind: 'redirect', status: 301, location: '/legal/privacy?x=1' });
    expect(route('/legal/privacy').kind).toBe('file');
    expect(route('/login//')).toEqual({ kind: 'redirect', status: 301, location: '/login' });
  });

  it('las rutas conocidas de la app sirven la SPA con noindex', () => {
    for (const url of [
      '/login',
      '/auth-callback',
      '/reset-password',
      '/home',
      '/courses',
      '/courses/abc-123',
      '/courses/class/9',
      '/courses/topics/7',
      '/documents/d1',
      '/s/token.con.puntos',
      '/legal/subscription',
      '/profile/edit',
      '/upload/scan',
    ]) {
      expect(route(url), url).toEqual({ kind: 'file', path: SPA_FILE, noindex: true });
    }
  });

  it('las rutas dinámicas exigen su segmento', () => {
    expect(isAppRoute('/courses/')).toBe(false);
    expect(isAppRoute('/documents')).toBe(false);
    expect(isAppRoute('/courses/a/b/c')).toBe(false);
  });

  it('los archivos de Expo y los públicos pasan directo a los estáticos', () => {
    for (const url of [
      '/_expo/static/js/web/entry-abc.js',
      '/assets/fonts/x.ttf',
      '/robots.txt',
      '/sitemap.xml',
      '/favicon.png',
      '/apuntor-icon.png',
    ]) {
      expect(route(url), url).toEqual({ kind: 'static' });
    }
  });

  it('lo desconocido es un 404 real, sin caer en la SPA', () => {
    for (const url of ['/nope', '/legal', '/login/extra', '/a/b/c', '/homee']) {
      expect(route(url), url).toEqual({ kind: 'not-found' });
    }
  });

  it('los .html internos no se exponen', () => {
    for (const url of ['/index.html', '/landing.html', '/legal/privacy.html', NOT_FOUND_FILE]) {
      expect(route(url), url).toEqual({ kind: 'not-found' });
    }
  });
});
