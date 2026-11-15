import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_LEGAL_DOCS, legalOutputPath, renderLegalPage } from '../scripts/legal-pages';
import { auth } from '../src/theme/tokens';
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
    '%s es siempre oscura (paleta auth), escala el texto y tiene fuente de reserva estable',
    (ruta) => {
      const html = read(ruta);
      expect(html).toContain('<meta name="color-scheme" content="dark">');
      expect(html).toContain('<meta name="text-scale" content="scale">');
      expect(html).toMatch(/:root\{color-scheme:dark;/);
      expect(html).not.toContain('light dark');
      expect(html).not.toContain('prefers-color-scheme');
      expect(html).toContain('font-size-adjust:from-font');
      expect(html).toContain(`<meta name="theme-color" content="${auth.bg}">`);
      // Los valores de la paleta salen de `auth` (tokens.ts), no se inventan.
      for (const value of [
        auth.bg,
        auth.card,
        auth.field,
        auth.text,
        auth.textMuted,
        auth.accent,
      ]) {
        expect(html.toUpperCase()).toContain(value.toUpperCase());
      }
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
    // El h1 lleva spans (palabra destacada y subrayado), pero su texto es exacto.
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect(h1.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '')).toBe(
      'Con Apuntor, estudiar con tus apuntes es más simple',
    );
    expect(html).toContain('<link rel="canonical" href="https://apuntor.com/">');
  });

  it('tiene los dos botones del hero con las rutas reales de la app', () => {
    expect(html).toMatch(
      /<a class="btn fill" href="\/register">(?:<svg[\s\S]*?<\/svg>)<span>Empieza ahora<\/span>/,
    );
    expect(html).toMatch(
      /<a class="btn line" href="\/login">(?:<svg[\s\S]*?<\/svg>)<span>Ya tengo una cuenta<\/span><\/a>/,
    );
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

  it('solo hay tres scripts: la redirección a /home con sesión, el respaldo del revelado y el menú', () => {
    const scripts = [...html.matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scripts).toHaveLength(3);
    const nav = scripts[2]?.[1] ?? '';
    // El menú solo marca la sección visible y cierra el panel del teléfono.
    expect(nav).toContain('aria-current');
    expect(nav).toContain('passive:true');
    expect(nav).toContain('menu.open=false');
    expect(nav).not.toMatch(/eval|innerHTML|document\.write|fetch|XMLHttpRequest|https?:\/\//);
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

  it('las secciones de abajo siguen siendo tipográficas: filas con filetes, pasos con numerales y CTA simple', () => {
    expect(html).toMatch(/<ol class="steps">/);
    expect(html).toMatch(/<ul class="rows">/);
    expect(html).toMatch(/<section class="cta( reveal)?"/);
    expect(html).not.toContain('Ejemplo de respuesta');
    expect(html).toMatch(/\.rows li::before\{content:counter\(fila/);
    expect(html).toMatch(/\.copy\{[^}]*text-align:left/);
  });

  it('las páginas legales y la 404 comparten cabecera y pie con la landing', () => {
    for (const ruta of ['public/404.html', 'public/legal/privacy.html']) {
      const pagina = read(ruta);
      expect(pagina).toContain('<svg class="logo"');
      expect(pagina).toContain('href="/legal/terms"');
      expect(pagina).toContain('max-width:1200px');
      expect(pagina).toContain('href="/login"');
    }
    expect(read('public/legal/terms.html')).toContain('main{max-width:70ch');
  });

  it('no promete tiendas y los planes de pago dicen que llegan pronto', () => {
    expect(html).not.toMatch(/app store|google play/i);
    const planes = /<section[^>]*id="planes"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(planes).toContain('Los planes de pago llegan muy pronto');
    for (const piece of [
      'S/ 0',
      'S/ 19.90',
      'S/ 189 al año (ahorras 20 %)',
      'S/ 9.90',
      'Hasta 50 preguntas al día',
      'IGV incluido',
      'Recomendado',
    ]) {
      expect(planes).toContain(piece);
    }
    // Los dos planes de pago no se pueden comprar todavía: botones deshabilitados, no enlaces.
    expect(
      planes.match(/<button class="btn line" type="button" disabled>Muy pronto<\/button>/g),
    ).toHaveLength(2);
    expect(planes).toMatch(/<a class="btn fill" href="\/register">Empieza gratis<\/a>/);
    expect(planes).toContain('href="/register">Mientras tanto, empieza gratis');
    expect(planes).toContain('soporte@apuntor.com');
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
  // El respaldo del revelado es el script que menciona `reveal-js`.
  const reveal =
    [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map((m) => m[1] ?? '')
      .find((code) => code.includes('reveal-js')) ?? '';

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
    for (const id of ['que-es', 'que-hace', 'como-funciona', 'planes', 'empezar']) {
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

describe('landing: rediseño oscuro', () => {
  const html = read('public/landing.html');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  it('la ilustración del hero lleva ancho, alto, prioridad alta, sin carga diferida y con WebP', () => {
    const picture = /<picture>[\s\S]*?<\/picture>/.exec(html)?.[0] ?? '';
    expect(picture).toContain('<source type="image/webp" srcset="/illari-estudiando.webp">');
    const img = /<img [^>]*>/.exec(picture)?.[0] ?? '';
    expect(img).toContain('src="/illari-estudiando.png"');
    expect(img).toContain('width="900"');
    expect(img).toContain('height="762"');
    expect(img).toContain('fetchpriority="high"');
    expect(img).not.toContain('loading="lazy"');
    expect(img).toMatch(/alt="[^"]*Illari[^"]*"/);
    // El hero ya no dibuja a Illari en SVG.
    expect(html).not.toContain('aria-label="Illari, la llama mascota');
  });

  it('las copias web de la ilustración existen, son ligeras y no se cuela el original de 2 MB', () => {
    const webp = readFileSync(path.join(appDir, 'public/illari-estudiando.webp'));
    expect(webp.length).toBeLessThan(300_000);
    expect(webp.subarray(0, 4).toString()).toBe('RIFF');
    expect(webp.subarray(8, 12).toString()).toBe('WEBP');
    const png = readFileSync(path.join(appDir, 'public/illari-estudiando.png'));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    // Misma proporción que las medidas declaradas en el HTML (900 × 762).
    expect(Math.abs(w / h - 900 / 762)).toBeLessThan(0.01);
    expect(png.length).toBeLessThan(600_000);
  });

  it('todos los enlaces internos de la barra apuntan a un id que existe y Entrar va a /login', () => {
    const navs = [...html.matchAll(/<nav class="(?:nav|menu-panel)"[\s\S]*?<\/nav>/g)].map(
      (m) => m[0],
    );
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const hrefs = [...nav.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1] ?? '');
      expect(hrefs).toEqual(['#inicio', '#que-hace', '#como-funciona', '#planes']);
      for (const href of hrefs) expect(ids.has(href.slice(1)), href).toBe(true);
      for (const label of ['Inicio', 'Características', 'Cómo funciona', 'Planes'])
        expect(nav).toContain(label);
    }
    expect(html).toMatch(/<a class="enter" href="\/login">[\s\S]*?Entrar<\/a>/);
  });

  it('en pantalla estrecha el menú es un <details> nativo y Entrar queda fuera de él', () => {
    const menu = /<details class="menu">[\s\S]*?<\/details>/.exec(html)?.[0] ?? '';
    expect(menu).toContain('<summary>');
    expect(menu).not.toContain('class="enter"');
    expect(html).toMatch(/\.nav\{display:none\}/);
    expect(html).toMatch(/@media \(min-width:900px\)\{[\s\S]*?\.menu\{display:none\}/);
  });

  it('cada ícono <use> existe en el sprite en línea y no hay recursos externos salvo Google Fonts', () => {
    const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
    const used = [...html.matchAll(/<use href="#([^"]+)"/g)].map((m) => m[1] ?? '');
    expect(used.length).toBeGreaterThan(10);
    for (const id of used) expect(symbols.has(id), id).toBe(true);
    const hosts = [...html.matchAll(/(?:href|src)="(https?:\/\/[^"/]+)/g)].map((m) => m[1]);
    for (const host of hosts) {
      expect([
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://apuntor.com',
      ]).toContain(host);
    }
  });

  it('la franja de formatos tiene sus cinco materiales y las insignias son SVG propios', () => {
    const strip = /<ul class="formats"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
    for (const kind of ['PDF', 'Word', 'PowerPoint', 'Texto', 'Fotos de tus hojas']) {
      expect(strip).toContain(kind);
    }
    expect(strip.match(/<svg class="bd"/g)).toHaveLength(3);
    expect(strip).not.toMatch(/<img/);
  });

  it('mantiene foco visible, movimiento reducido y escala de texto', () => {
    expect(html).toContain(':focus-visible{outline:2px solid var(--accent)');
    expect(html).toContain('@media (prefers-reduced-motion:reduce)');
    expect(html).toContain('<meta name="text-scale" content="scale">');
  });
});
