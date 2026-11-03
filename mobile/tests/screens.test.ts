/// <reference types="node" />
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { allScreens } from '../src/data/screens';

const APP = path.resolve(__dirname, '../src/app');

/** Resuelve una ruta de Expo Router a su archivo, probando grupos y segmentos dinámicos. */
function routeExists(href: string): boolean {
  const clean = href.split('?')[0] ?? '';
  const segments = clean.split('/').filter(Boolean);
  const groups = ['', '(auth)', '(tabs)'];
  const walk = (dir: string, rest: string[]): boolean => {
    if (rest.length === 0) return existsSync(path.join(dir, 'index.tsx'));
    const [head, ...tail] = rest as [string, ...string[]];
    if (tail.length === 0 && existsSync(path.join(dir, `${head}.tsx`))) return true;
    if (existsSync(path.join(dir, head)) && walk(path.join(dir, head), tail)) return true;
    // segmento dinámico [param]
    const dynFile = ['[courseId]', '[topicId]', '[documentId]', '[token]'];
    for (const d of dynFile) {
      if (tail.length === 0 && existsSync(path.join(dir, `${d}.tsx`))) return true;
    }
    return false;
  };
  return groups.some((g) => walk(path.join(APP, g), segments));
}

describe('mapa de pantallas', () => {
  it('tiene las 52 pantallas, sin números repetidos', () => {
    const numbers = allScreens.map((s) => s.n).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
  });

  it.each(allScreens.map((s) => [s.n, s.href] as const))(
    'la pantalla %i (%s) tiene su archivo de ruta',
    (_n, href) => {
      expect(routeExists(href)).toBe(true);
    },
  );
});
