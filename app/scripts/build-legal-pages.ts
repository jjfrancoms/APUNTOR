/**
 * Regenera `public/legal/*.html` desde `src/i18n/legal.ts`.
 * Uso: `npm run legal:html` (en la raíz). Commitea los archivos resultantes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_LEGAL_DOCS, legalOutputPath, renderLegalPage } from './legal-pages';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const doc of PUBLIC_LEGAL_DOCS) {
  const file = resolve(appDir, legalOutputPath(doc));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderLegalPage(doc), 'utf8');
  console.log(`escrito ${legalOutputPath(doc)}`);
}
