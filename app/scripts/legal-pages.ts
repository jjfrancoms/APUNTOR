/**
 * HTML estático de las páginas legales públicas (`/legal/privacy`, `/legal/terms`).
 *
 * El texto sale de `src/i18n/legal.ts` (español), igual que en la app. Los archivos generados
 * se guardan en `public/legal/` y se commitean: Expo los copia a `dist/`. Un test falla si
 * el texto cambia y los archivos no se regeneran (`npm run legal:html` en la raíz).
 */
import {
  LEGAL,
  LEGAL_LABELS,
  LEGAL_UPDATED,
  LEGAL_VERSION,
  type LegalDoc,
} from '../src/i18n/legal';
import {
  HORIZONTAL_VIEWBOX as VB,
  ISOTIPO_PATH,
  ISOTIPO_TRANSFORM,
  LETRAS_PATH,
  LETRAS_TRANSFORM,
} from '../src/components/ui/brandLogoPaths';

export const SITE_URL = 'https://apuntor.com';

/** Documentos públicos: el de suscripción se queda dentro de la app. */
export type PublicLegalDoc = Extract<LegalDoc, 'privacy' | 'terms'>;

export const PUBLIC_LEGAL_DOCS: readonly PublicLegalDoc[] = ['privacy', 'terms'];

const TITLES: Readonly<Record<PublicLegalDoc, string>> = {
  privacy: 'Política de privacidad',
  terms: 'Términos y condiciones',
};

const DESCRIPTIONS: Readonly<Record<PublicLegalDoc, string>> = {
  privacy:
    'Qué datos trata Apuntor (incluidos los de Google al iniciar sesión), para qué los usa y cómo ejercer tus derechos.',
  terms: 'Las condiciones para usar Apuntor, la app de estudio con tus propios apuntes.',
};

/** Ruta de salida relativa a `app/`. */
export function legalOutputPath(doc: PublicLegalDoc): string {
  return `public/legal/${doc}.html`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Paleta `auth` de DESIGN.md («Pantallas de acceso»), siempre oscura. Sin JavaScript ni recursos externos.
/** Logo horizontal en línea (el color sale de `fill` en CSS). */
const BRAND_LOGO =
  `<svg class="logo" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" aria-hidden="true" focusable="false"><title>Apuntor</title>` +
  `<g transform="${ISOTIPO_TRANSFORM}"><path fill-rule="evenodd" d="${ISOTIPO_PATH}"/></g>` +
  `<g transform="${LETRAS_TRANSFORM}"><path d="${LETRAS_PATH}"/></g></svg>`;

/** Ícono «log-in» (Feather) del botón Entrar. */
const ICON_LOGIN =
  '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';

const CSS = `:root{color-scheme:dark;--bg:#0D2427;--bg-deep:#08191B;--card:#0F292C;--field:#0A1D20;--field-border:#2F5254;--card-border:#4DB6A68C;--text:#F2F7F6;--muted:#9DB8B5;--accent:#3FD0B5;--accent-ring:#3FD0B538;--card-glow:#4DB6A640;--glow:#1D7568;--r:14px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:var(--bg-deep)}
body{margin:0;font-size-adjust:from-font;background:radial-gradient(48rem 26rem at 10% 0,color-mix(in srgb,var(--glow) 45%,transparent),transparent 70%),var(--bg);background-repeat:no-repeat;color:var(--text);font:400 1rem/1.6 "Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
.wrap{max-width:1200px;margin:0 auto;padding:0 20px}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:80px}
.brand{display:inline-flex;align-items:center;min-height:44px;color:var(--accent);text-decoration:none}
.brand .logo{display:block;height:2.5rem;width:auto;fill:var(--accent)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.i{width:1.25rem;height:1.25rem;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.enter{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 18px;border:1px solid var(--card-border);border-radius:var(--r);background:color-mix(in srgb,var(--field) 70%,transparent);color:var(--accent);font-weight:700;font-size:0.9375rem;text-decoration:none;box-shadow:0 0 22px var(--card-glow)}
.enter:hover{background:var(--accent-ring)}
main{max-width:70ch;padding:16px 0 40px}
h1{font-size:1.75rem;line-height:2.125rem;font-weight:800;letter-spacing:-.02em;margin:16px 0 8px}
.meta{color:var(--muted);font-size:0.8125rem;line-height:1.125rem;margin:0 0 24px}
section{border-top:1px solid var(--field-border);padding:24px 0}
h2{font-size:1.125rem;line-height:1.5rem;font-weight:700;margin:0 0 12px}
p{margin:0 0 12px;overflow-wrap:anywhere}
p:last-child{margin-bottom:0}
footer{border-top:1px solid var(--field-border);padding:16px 0 32px;color:var(--muted);font-size:0.875rem;line-height:1.25rem}
footer .wrap{display:flex;flex-wrap:wrap;gap:0 24px;align-items:center}
footer a{color:var(--muted);display:inline-flex;align-items:center;min-height:44px}
footer a:hover{color:var(--accent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (min-width:900px){.wrap{padding:0 32px}h1{font-size:2.25rem;line-height:2.75rem}}`;

export function renderLegalPage(doc: PublicLegalDoc): string {
  const title = TITLES[doc];
  const labels = LEGAL_LABELS.es;
  const sections = LEGAL.es[doc]
    .map((section) => {
      const paragraphs = section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
      return `<section>\n<h2>${escapeHtml(section.title)}</h2>\n${paragraphs}\n</section>`;
    })
    .join('\n');
  const url = `${SITE_URL}/legal/${doc}`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Siempre oscura: se declara antes de pintar y respeta el tamaño de texto del sistema. -->
<meta name="color-scheme" content="dark">
<meta name="text-scale" content="scale">
<title>${escapeHtml(title)} · Apuntor</title>
<meta name="description" content="${escapeHtml(DESCRIPTIONS[doc])}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0D2427">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Apuntor">
<meta property="og:title" content="${escapeHtml(title)} · Apuntor">
<meta property="og:description" content="${escapeHtml(DESCRIPTIONS[doc])}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/apuntor-icon.png">
<meta name="twitter:card" content="summary">
<style>
${CSS}
</style>
</head>
<body>
<div class="wrap">
<header class="bar">
<a class="brand" href="/">${BRAND_LOGO}<span class="sr">Apuntor</span></a>
<a class="enter" href="/login">${ICON_LOGIN}Entrar</a>
</header>
<main>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(`${labels.updated}: ${LEGAL_UPDATED.es} · ${labels.version} ${LEGAL_VERSION}`)}</p>
${sections}
</main>
</div>
<footer>
<div class="wrap">
<a href="/">Inicio</a>
<a href="/legal/privacy">Política de privacidad</a>
<a href="/legal/terms">Términos y condiciones</a>
</div>
</footer>
</body>
</html>
`;
}
