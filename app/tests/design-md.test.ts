import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colors, motion, type ColorTokens } from '../src/theme/tokens';

const designMd = readFileSync(join(__dirname, '..', '..', 'DESIGN.md'), 'utf8');

describe('DESIGN.md', () => {
  it('lista cada token de color con los mismos valores que tokens.ts', () => {
    for (const token of Object.keys(colors.light) as (keyof ColorTokens)[]) {
      const row = designMd.split('\n').find((line) => line.startsWith(`| \`${token}\``));
      expect(row, `falta la fila de ${token}`).toBeDefined();
      expect(row).toContain(colors.light[token]);
      expect(row).toContain(colors.dark[token]);
    }
  });

  it('documenta los tokens de movimiento con los mismos valores que tokens.ts', () => {
    const row = (token: string) => {
      const line = designMd.split('\n').find((l) => l.startsWith(`| \`${token}\``));
      expect(line, `falta la fila de ${token}`).toBeDefined();
      return line ?? '';
    };
    for (const [name, ms] of Object.entries(motion.duration)) {
      expect(row(`motion.duration.${name}`)).toContain(`${ms} ms`);
    }
    for (const [name, curve] of Object.entries(motion.easing)) {
      expect(row(`motion.easing.${name}`)).toContain(curve.join(', '));
    }
    expect(row('motion.pressScale')).toContain(String(motion.pressScale));
  });

  it('pide acciones sin caja cuando basta el ícono', () => {
    expect(designMd).toContain('No todo va en una caja');
  });
});
