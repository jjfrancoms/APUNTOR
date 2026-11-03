import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

const ui = files(join(SRC, 'app')).concat(files(join(SRC, 'components')));
const rel = (p: string) => p.slice(SRC.length + 1);

/** Reglas que salieron de la auditoría con las skills de diseño (ver CLAUDE.md). */
describe('convenciones de interfaz', () => {
  it('todo lo tocable usa Tap (respuesta al toque uniforme)', () => {
    const offenders = ui
      .filter((p) => !p.endsWith(join('ui', 'Tap.tsx')))
      .filter((p) => /<Pressable\b/u.test(readFileSync(p, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('sin colores sueltos en pantallas y componentes (salvo la ilustración)', () => {
    const offenders = ui
      .filter((p) => /#[0-9a-f]{6}\b|rgba?\(/iu.test(readFileSync(p, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
