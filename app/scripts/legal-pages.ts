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

// Paleta de DESIGN.md (claro y oscuro). Sin JavaScript ni recursos externos.
const CSS = `:root{--bg:#FAF9F6;--surface:#FFFFFF;--border:#E7E4DD;--text:#1C1C1E;--muted:#6B6B72;--primary:#1D7568;--on-primary:#FFFFFF}
@media (prefers-color-scheme:dark){:root{--bg:#121413;--surface:#1C1F1E;--border:#363B3A;--text:#F2F2F0;--muted:#A9AEAC;--primary:#4DB6A6;--on-primary:#0B1F1C}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 16px/1.6 "Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--primary)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:720px;margin:0 auto;padding:16px 20px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);font-weight:800;font-size:18px;text-decoration:none}
.brand img{width:32px;height:32px;border-radius:8px}
.enter{display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:12px;background:var(--primary);color:var(--on-primary);font-weight:700;text-decoration:none}
main{max-width:720px;margin:0 auto;padding:8px 20px 32px}
h1{font-size:28px;line-height:34px;font-weight:800;margin:16px 0 8px}
.meta{color:var(--muted);font-size:13px;line-height:18px;margin:0 0 24px}
section{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin:0 0 16px}
h2{font-size:18px;line-height:24px;font-weight:700;margin:0 0 12px}
p{margin:0 0 12px;overflow-wrap:anywhere}
p:last-child{margin-bottom:0}
footer{max-width:720px;margin:0 auto;padding:16px 20px 40px;color:var(--muted);font-size:13px;line-height:18px;display:flex;flex-wrap:wrap;gap:8px 20px}
footer a{color:var(--muted)}
a:focus-visible{outline:2px solid var(--primary);outline-offset:3px}`;

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
<title>${escapeHtml(title)} · Apuntor</title>
<meta name="description" content="${escapeHtml(DESCRIPTIONS[doc])}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.png" type="image/png">
<meta name="theme-color" content="#FAF9F6">
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
<header class="bar">
<a class="brand" href="/"><img src="/apuntor-icon-192.png" alt="" width="32" height="32">Apuntor</a>
<a class="enter" href="/login">Entrar</a>
</header>
<main>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(`${labels.updated}: ${LEGAL_UPDATED.es} · ${labels.version} ${LEGAL_VERSION}`)}</p>
${sections}
</main>
<footer>
<a href="/">Inicio</a>
<a href="/legal/privacy">Política de privacidad</a>
<a href="/legal/terms">Términos y condiciones</a>
</footer>
</body>
</html>
`;
}
