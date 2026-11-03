import { describe, expect, it } from 'vitest';
import { chunkPages } from '../src/services/ingestion/pdf-parser';
import {
  buildTopicTree,
  flattenTopicTree,
  MAX_TOPICS,
  type TopicSource,
} from '../src/services/topics/topic-tree';

describe('buildTopicTree', () => {
  it('arma la jerarquía por prefijos de sectionPath y acumula páginas reales', () => {
    const sources: TopicSource[] = [
      { pageNumber: 1, sectionPath: ['1. Célula'] },
      { pageNumber: 2, sectionPath: ['1. Célula', '1.1 Teoría celular'] },
      { pageNumber: 4, sectionPath: ['1. Célula', '1.2 Organelos'] },
      { pageNumber: 5, sectionPath: ['1. Célula', '1.2 Organelos', 'Mitocondria'] },
      { pageNumber: 9, sectionPath: ['2. Genética'] },
    ];
    expect(buildTopicTree(sources)).toEqual([
      {
        title: '1. Célula',
        level: 1,
        sourcePages: [1, 2, 4, 5],
        children: [
          { title: '1.1 Teoría celular', level: 2, sourcePages: [2], children: [] },
          {
            title: '1.2 Organelos',
            level: 2,
            sourcePages: [4, 5],
            children: [{ title: 'Mitocondria', level: 3, sourcePages: [5], children: [] }],
          },
        ],
      },
      { title: '2. Genética', level: 1, sourcePages: [9], children: [] },
    ]);
  });

  it('respeta el orden de aparición aunque los chunks lleguen desordenados', () => {
    const tree = buildTopicTree([
      { pageNumber: 7, sectionPath: ['B'] },
      { pageNumber: 2, sectionPath: ['A'] },
    ]);
    expect(tree.map((t) => t.title)).toEqual(['A', 'B']);
  });

  it('deduplica páginas y normaliza espacios del título', () => {
    const tree = buildTopicTree([
      { pageNumber: 3, sectionPath: ['  Tema   uno '] },
      { pageNumber: 3, sectionPath: ['Tema uno'] },
      { pageNumber: 1, sectionPath: ['Tema uno'] },
    ]);
    expect(tree).toEqual([{ title: 'Tema uno', level: 1, sourcePages: [1, 3], children: [] }]);
  });

  it('ignora chunks sin sección y títulos vacíos', () => {
    expect(
      buildTopicTree([
        { pageNumber: 1, sectionPath: [] },
        { pageNumber: 2, sectionPath: ['  '] },
      ]),
    ).toEqual([]);
  });

  it('limita la cantidad de temas', () => {
    const sources = Array.from({ length: MAX_TOPICS + 50 }, (_, i) => ({
      pageNumber: i + 1,
      sectionPath: [`Tema ${i}`],
    }));
    expect(buildTopicTree(sources)).toHaveLength(MAX_TOPICS);
  });

  it('rechaza páginas inválidas', () => {
    expect(() => buildTopicTree([{ pageNumber: 0, sectionPath: ['X'] }])).toThrow(RangeError);
  });

  it('funciona con la salida real del chunker', () => {
    const chunks = chunkPages(
      [
        { pageNumber: 1, text: 'CAPÍTULO 1\nIntroducción general.\n1.1 Objetivos\nAprender.' },
        { pageNumber: 2, text: 'Seguimos con objetivos.\n1.2 Método\nObservar.' },
      ],
      { maxTokens: 100, overlapTokens: 0 },
    );
    const tree = buildTopicTree(chunks);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.title).toBe('CAPÍTULO 1');
    expect(tree[0]?.sourcePages).toEqual([1, 2]);
    expect(tree[0]?.children.map((c) => [c.title, c.sourcePages])).toEqual([
      ['1.1 Objetivos', [1, 2]],
      ['1.2 Método', [2]],
    ]);
  });
});

describe('flattenTopicTree', () => {
  it('produce preorden con padres antes que hijos', () => {
    const flat = flattenTopicTree(
      buildTopicTree([
        { pageNumber: 1, sectionPath: ['A', 'A.1'] },
        { pageNumber: 2, sectionPath: ['A', 'A.2', 'A.2.a'] },
        { pageNumber: 3, sectionPath: ['B'] },
      ]),
    );
    expect(flat.map((t) => [t.title, t.parentIndex])).toEqual([
      ['A', null],
      ['A.1', 0],
      ['A.2', 0],
      ['A.2.a', 2],
      ['B', null],
    ]);
    for (const [i, t] of flat.entries()) {
      if (t.parentIndex !== null) expect(t.parentIndex).toBeLessThan(i);
    }
  });
});
