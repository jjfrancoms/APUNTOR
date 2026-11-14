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

describe('buenas prácticas web compartidas', () => {
  const paginas = [
    'public/landing.html',
    'public/404.html',
    'public/legal/privacy.html',
    'public/legal/terms.html',
  ];

  it.each(paginas)(
    '%s declara ambos temas, escala de texto y fuente de reserva estable',
    (ruta) => {
      const html = read(ruta);
      expect(html).toContain('<meta name="color-scheme" content="light dark">');
      expect(html).toContain('<meta name="text-scale" content="scale">');
      expect(html).toMatch(/:root\{color-scheme:light dark;/);
      expect(html).toContain('font-size-adjust:from-font');
      expect(html).toMatch(/theme-color" content="#121413" media="\(prefers-color-scheme: dark\)"/);
      // El texto escala con el sistema: nada de tamaños de fuente en px.
      expect(html).not.toMatch(/font-size:\d+px/);
    },
  );
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
    // Logo horizontal en SVG (decorativo) junto al nombre en texto, que es lo que lee Google.
    expect(html).toMatch(
      /<a class="brand" href="\/"><svg class="logo"[^>]*aria-hidden="true"[\s\S]*?<title>Apuntor<\/title>[\s\S]*?<\/svg><span class="sr">Apuntor<\/span><\/a>/,
    );
    for (const piece of ['mayores de 18 años', 'página', 'resumen', 'quizzes', 'flashcards']) {
      expect(html.toLowerCase()).toContain(piece);
    }
    for (const kind of ['PDF', 'Word', 'PowerPoint', 'Texto', 'Fotos'])
      expect(html).toContain(kind);
    expect(html).toContain('href="/legal/privacy"');
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('Solo para personas de 18 años o más');
  });

  it('solo hay dos scripts: la redirección a /home cuando ya hay sesión y el respaldo del revelado', () => {
    const scripts = [...html.matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(2);
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

  it('las secciones son tipográficas y no se centran: filas con filetes, pasos con numerales y CTA simple', () => {
    expect(html).toMatch(/<ol class="steps">/);
    expect(html).toMatch(/<ul class="rows">/);
    expect(html).toMatch(/<section class="cta( reveal)?"/);
    // Sin adornos genéricos: pegatinas, fichas con ícono, chips, pastillas ni tarjeta de ejemplo.
    expect(html).not.toMatch(/class="(fl |pill|mock|chips|ico|card)/);
    expect(html).not.toContain('Ejemplo de respuesta');
    expect(html).not.toMatch(/border-radius:(20|24)px/);
    expect(html).toMatch(/\.copy\{text-align:left/);
  });

  it('las páginas legales y la 404 comparten cabecera y pie con la landing', () => {
    for (const ruta of ['public/404.html', 'public/legal/privacy.html']) {
      const pagina = read(ruta);
      expect(pagina).toContain('<svg class="logo"');
      expect(pagina).toContain('href="/legal/terms"');
      expect(pagina).toContain('max-width:1120px');
    }
    expect(read('public/legal/terms.html')).toContain('main{max-width:70ch');
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

describe('íconos del kit de marca', () => {
  /** Lado en px de un PNG cuadrado, leído de su cabecera IHDR. */
  const pngSide = (file: string): [number, number] => {
    const buf = readFileSync(path.join(appDir, file));
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  };

  it.each([
    ['public/apuntor-icon.png', 1024],
    ['public/apuntor-icon-192.png', 192],
    ['public/apple-touch-icon.png', 180],
    ['public/favicon.png', 48],
    ['public/favicon-32.png', 32],
    ['public/favicon-16.png', 16],
    ['assets/icon.png', 1024],
    ['assets/android-icon-foreground.png', 1024],
    ['assets/android-icon-background.png', 1024],
    ['assets/android-icon-monochrome.png', 1024],
    ['assets/splash-icon.png', 1024],
  ] as const)('%s es un PNG de %i px', (file, side) => {
    expect(pngSide(file)).toEqual([side, side]);
  });

  it.each([
    'public/landing.html',
    'public/404.html',
    'public/legal/privacy.html',
    'public/legal/terms.html',
  ])('%s declara favicon 32/16 y apple-touch-icon', (file) => {
    const html = read(file);
    expect(html).toContain(
      '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">',
    );
    expect(html).toContain(
      '<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">',
    );
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
  });

  it('el kit vive en docs/marca y el logo de JSON-LD apunta al ícono nuevo', () => {
    expect(
      existsSync(path.join(appDir, '..', 'docs/marca/svg/apuntor-logo-horizontal-color.svg')),
    ).toBe(true);
    expect(read('public/landing.html')).toContain('"logo":"https://apuntor.com/apuntor-icon.png"');
  });
});

describe('landing: revelado al hacer scroll', () => {
  const html = read('public/landing.html');
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
  const body = html.slice(html.indexOf('<body>'));
  const reveal = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

  it('el revelado nativo va tras @supports y solo con movimiento permitido', () => {
    const block = /@media \(prefers-reduced-motion:no-preference\)\{([\s\S]*?)\n\}\n/.exec(
      css,
    )?.[1];
    expect(block).toBeDefined();
    expect(block).toContain('@supports (animation-timeline:view())');
    expect(block).toContain('animation-timeline:view()');
    // 12 px de desplazamiento, solo opacity y transform.
    expect(block).toContain('translateY(12px)');
  });

  it('nada queda oculto por defecto: la clase que oculta solo la añade el JavaScript', () => {
    expect(body).not.toMatch(/class="[^"]*reveal-js/);
    // `.reveal` por sí sola nunca fija opacity:0 fuera de la animación nativa.
    expect(css).not.toMatch(/\.reveal\{[^}]*opacity:0/);
    // `.reveal-js` (el estado oculto) vive solo dentro del bloque de movimiento permitido.
    const media = css.indexOf('@media (prefers-reduced-motion:no-preference)');
    expect(media).toBeGreaterThan(-1);
    expect(css.indexOf('.reveal-js')).toBeGreaterThan(media);
  });

  it('el hero no se revela y las secciones de abajo sí', () => {
    const hero = /<section class="hero">[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(hero).not.toContain('reveal');
    for (const id of ['que-es', 'que-hace', 'como-funciona', 'empezar']) {
      expect(html).toMatch(
        new RegExp(
          `class="[^"]*\\breveal\\b[^"]*"[^>]*(aria-labelledby="${id}"|id="${id}")|id="${id}"`,
        ),
      );
    }
    expect(body.match(/class="reveal"/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it('el respaldo no actúa con movimiento reducido ni con soporte nativo, y no usa scroll', () => {
    expect(reveal).toContain("CSS.supports('animation-timeline','view()')");
    expect(reveal).toContain('prefers-reduced-motion: reduce');
    expect(reveal).toContain('IntersectionObserver');
    expect(reveal).toContain('unobserve');
    expect(reveal).not.toMatch(/addEventListener\(['"]scroll|eval|innerHTML|fetch|https?:\/\//);
  });
});
