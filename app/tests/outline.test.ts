import { describe, expect, it } from 'vitest';
import { formatPageRanges, outlineTree, toggleExpanded, withDepth } from '../src/lib/outline';

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

  it('arma el árbol con sus subtemas en orden', () => {
    const tree = outlineTree(topics);
    expect(tree.map((n) => n.topic.id)).toEqual(['cap', 'ej']);
    expect(tree[0]?.children[0]?.children.map((n) => n.topic.id)).toEqual(['t11']);
  });

  it('abre y cierra un tema; al cerrarlo se cierran sus subtemas', () => {
    const [cap] = outlineTree(topics);
    if (!cap) throw new Error('sin árbol');
    const tema = cap.children[0];
    if (!tema) throw new Error('sin tema');
    let open = toggleExpanded(new Set(), cap);
    open = toggleExpanded(open, tema);
    expect([...open]).toEqual(['cap', 'tema1']);
    expect([...toggleExpanded(open, cap)]).toEqual([]);
  });

  it('une páginas consecutivas', () => {
    expect(formatPageRanges([5, 1, 2, 3, 8, 9, 2])).toBe('1–3, 5, 8–9');
    expect(formatPageRanges([4])).toBe('4');
    expect(formatPageRanges([])).toBe('');
  });
});
