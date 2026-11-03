import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colors, type ColorTokens } from '../src/design/tokens';

const designMd = readFileSync(join(__dirname, '..', 'DESIGN.md'), 'utf8');

describe('DESIGN.md', () => {
  it('lista cada token de color con los mismos valores que tokens.ts', () => {
    for (const token of Object.keys(colors.light) as (keyof ColorTokens)[]) {
      const row = designMd.split('\n').find((line) => line.startsWith(`| \`${token}\``));
      expect(row, `falta la fila de ${token}`).toBeDefined();
      expect(row).toContain(colors.light[token]);
      expect(row).toContain(colors.dark[token]);
    }
  });
});
