import { describe, expect, it } from 'vitest';
import { formatPageRanges, outlineSections, withDepth } from '../src/lib/outline';

const topics = withDepth([
  { id: 'cap', parentId: null, title: 'Capítulo I', sourcePages: [1, 2, 3] },
  { id: 'tema1', parentId: 'cap', title: 'Tema 1', sourcePages: [1, 2] },
  { id: 't11', parentId: 'tema1', title: '1.1 Definiciones', sourcePages: [1] },
  { id: 'ej', parentId: null, title: 'Ejercicios', sourcePages: [4] },
]);

describe('índice de temas del documento', () => {
  it('calcula la profundidad desde parentId', () => {
    expect(topics.map((t) => [t.id, t.depth])).toEqual([
      ['cap', 1],
      ['tema1', 2],
      ['t11', 3],
      ['ej', 1],
    ]);
  });

  it('agrupa cada tema raíz con todos sus subtemas', () => {
    expect(outlineSections(topics).map((s) => [s.topic.id, s.children.map((c) => c.id)])).toEqual([
      ['cap', ['tema1', 't11']],
      ['ej', []],
    ]);
  });

  it('une páginas consecutivas', () => {
    expect(formatPageRanges([5, 1, 2, 3, 8, 9, 2])).toBe('1–3, 5, 8–9');
    expect(formatPageRanges([4])).toBe('4');
    expect(formatPageRanges([])).toBe('');
  });
});
