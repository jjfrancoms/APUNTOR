import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_LEGAL_DOCS, legalOutputPath, renderLegalPage } from '../scripts/legal-pages';
import { APP_ROUTES, PUBLIC_PAGES } from '../worker/routing';

const appDir = path.resolve(__dirname, '..');
const read = (file: string) => readFileSync(path.join(appDir, file), 'utf8');

describe('páginas legales estáticas', () => {
  it.each(PUBLIC_LEGAL_DOCS)(
    '%s: el HTML commiteado está al día con src/i18n/legal.ts (corre `npm run legal:html`)',
    (doc) => {
      expect(read(legalOutputPath(doc))).toBe(renderLegalPage(doc));
    },
  );

  it('cada ruta pública del Worker tiene su archivo', () => {
    for (const file of Object.values(PUBLIC_PAGES)) {
      expect(existsSync(path.join(appDir, 'public', file))).toBe(true);
    }
  });

  it('la política de privacidad dice qué datos de Google se usan y para qué', () => {
    const html = read(legalOutputPath('privacy'));
    for (const piece of ['correo electrónico', 'nombre', 'foto de perfil', 'openid']) {
      expect(html).toContain(piece);
    }
  });
});

describe('landing', () => {
  const html = read('public/landing.html');

  it('es HTML completo en español con Apuntor en el título y el h1', () => {
    expect(html).toContain('<html lang="es">');
    expect(html).toMatch(/<title>[^<]*Apuntor[^<]*<\/title>/);
    expect(html).toMatch(/<h1>[^<]*Apuntor[^<]*<\/h1>/);
    expect(html).toContain('<link rel="canonical" href="https://apuntor.com/">');
  });

  it('tiene los dos botones del hero con las rutas reales de la app', () => {
    expect(html).toMatch(/<a class="btn fill" href="\/register">Empieza ahora<\/a>/);
    expect(html).toMatch(/<a class="btn line" href="\/login">Ya tengo una cuenta<\/a>/);
    expect(APP_ROUTES).toContain('/register');
    expect(APP_ROUTES).toContain('/login');
    expect(APP_ROUTES).toContain('/home');
  });

  it('muestra el nombre en la barra, explica el producto y enlaza a los textos legales', () => {
    expect(html).toMatch(/<a class="brand"[^>]*>[^<]*<img[^>]*>Apuntor<\/a>/);
    for (const piece of ['mayores de 18 años', 'página', 'resumen', 'quizzes', 'flashcards']) {
      expect(html.toLowerCase()).toContain(piece);
    }
    for (const kind of ['PDF', 'Word', 'PowerPoint', 'Texto', 'Fotos'])
      expect(html).toContain(kind);
    expect(html).toContain('href="/legal/privacy"');
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('Solo para personas de 18 años o más');
  });

  it('el único JavaScript es la redirección a /home cuando ya hay sesión, y es seguro', () => {
    const scripts = [...html.matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(1);
    const code = scripts[0]?.[1] ?? '';
    expect(code).toContain("location.replace('/home')");
    // Clave de sesión de Supabase (`sb-<ref>-auth-token`) sin fijar el proyecto.
    expect(code).toContain('sb-');
    expect(code).toContain('-auth-token');
    expect(code).toContain('refresh_token');
    expect(code).toContain('try{');
    expect(code).not.toMatch(/eval|innerHTML|document\.write|fetch|XMLHttpRequest|https?:\/\//);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
  });

  it('la redirección solo actúa con una sesión guardada', () => {
    const code = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    const run = (items: Record<string, string>) => {
      const replaced: string[] = [];
      const storage = {
        length: Object.keys(items).length,
        key: (i: number) => Object.keys(items)[i] ?? null,
        getItem: (k: string) => items[k] ?? null,
      };
      new Function('window', 'location', code)(
        { localStorage: storage },
        {
          replace: (u: string) => replaced.push(u),
        },
      );
      return replaced;
    };
    expect(run({})).toEqual([]);
    expect(run({ 'sb-abc-auth-token': '{no es json' })).toEqual([]);
    expect(run({ 'sb-abc-auth-token-code-verifier': 'x' })).toEqual([]);
    expect(run({ 'sb-abc-auth-token': '{"access_token":"a"}' })).toEqual([]);
    expect(run({ 'sb-abc-auth-token': '{"access_token":"a","refresh_token":"r"}' })).toEqual([
      '/home',
    ]);
  });

  it('el JSON-LD es válido y declara Organization y WebSite', () => {
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    const data = JSON.parse(match?.[1] ?? '{}') as {
      '@graph': { '@type': string; name: string }[];
    };
    const types = data['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['Organization', 'WebSite']);
    for (const node of data['@graph']) expect(node.name).toBe('Apuntor');
  });

  it('no promete precios ni tiendas', () => {
    expect(html).not.toMatch(/gratis|gratuit|free|S\/\s?\d|app store|google play/i);
  });
});

describe('robots.txt y sitemap.xml', () => {
  const robots = read('public/robots.txt');
  const sitemap = read('public/sitemap.xml');

  it('robots permite lo público, bloquea las pantallas de la app y apunta al sitemap', () => {
    expect(robots).toContain('Allow: /legal/');
    expect(robots).toContain('Sitemap: https://apuntor.com/sitemap.xml');
    for (const url of ['login', 'home', 'courses', 'chat', 'profile', 'admin', 'upload']) {
      expect(robots).toContain(`Disallow: /${url}`);
    }
    // Ninguna ruta bloqueada puede ser pública.
    const disallowed = [...robots.matchAll(/^Disallow: (\S+)$/gm)].map((m) => m[1] ?? '');
    for (const page of ['/', ...Object.keys(PUBLIC_PAGES)]) {
      expect(disallowed.some((d) => page.startsWith(d))).toBe(false);
    }
  });

  it('robots cubre cada pantalla de la app (primer segmento)', () => {
    const disallowed = [...robots.matchAll(/^Disallow: (\S+)$/gm)].map((m) => m[1] ?? '');
    for (const route of APP_ROUTES) {
      if (route.startsWith('/legal/')) continue;
      expect(
        disallowed.some((d) => route === d || route.startsWith(d.endsWith('/') ? d : `${d}/`)),
        route,
      ).toBe(true);
    }
  });

  it('el sitemap lista solo la landing y los dos textos legales', () => {
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls).toEqual([
      'https://apuntor.com/',
      'https://apuntor.com/legal/privacy',
      'https://apuntor.com/legal/terms',
    ]);
  });
});
