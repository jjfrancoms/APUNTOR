import { describe, expect, it } from 'vitest';
import {
  buildTopicContent,
  joinWithoutOverlap,
  MAX_TOPIC_CHARS,
  topicPath,
  withPageStructure,
  type ChunkRow,
  type TopicRow,
} from '../../api/src/topic-content';

const topics: TopicRow[] = [
  { id: 'cap', parentId: null, title: 'Capítulo  I', sourcePages: [1, 2] },
  { id: 'tema', parentId: 'cap', title: '1.1 Tablas', sourcePages: [1, 2] },
  { id: 'otro', parentId: 'cap', title: '1.2 Leyes', sourcePages: [2] },
];
const chunk = (i: number, page: number, path: string[], content: string): ChunkRow => ({
  chunkIndex: i,
  pageNumber: page,
  sectionPath: path,
  content,
  charStart: 0,
  charEnd: content.length,
});

describe('contenido de un tema', () => {
  it('arma la ruta desde la raíz con títulos normalizados', () => {
    expect(topicPath(topics, 'tema')).toEqual(['Capítulo I', '1.1 Tablas']);
    expect(topicPath(topics, 'nada')).toBeNull();
  });

  it('quita las palabras que repite el fragmento siguiente', () => {
    expect(joinWithoutOverlap('a b c d e', 'd e f g')).toBe('a b c d e f g');
    expect(joinWithoutOverlap('a b c', 'x y')).toBe('a b c x y');
  });

  it('junta por página el texto del tema y de sus subtemas, sin el de otros temas', () => {
    const chunks = [
      chunk(0, 1, ['Capítulo I'], 'Intro del capítulo'),
      chunk(1, 1, ['Capítulo I', '1.1 Tablas'], 'Una tabla de verdad muestra'),
      chunk(2, 1, ['Capítulo I', '1.1 Tablas'], 'verdad muestra todos los casos'),
      chunk(3, 2, ['Capítulo I', '1.1 Tablas'], 'Sigue en la página dos'),
      chunk(4, 2, ['Capítulo I', '1.2 Leyes'], 'Otro tema'),
    ];
    const content = buildTopicContent(topics, chunks, 'tema');
    expect(content?.path).toEqual(['Capítulo I', '1.1 Tablas']);
    expect(content?.blocks.map((b) => [b.pageNumber, b.text])).toEqual([
      [1, 'Una tabla de verdad muestra todos los casos'],
      [2, 'Sigue en la página dos'],
    ]);
    expect(buildTopicContent(topics, chunks, 'cap')?.blocks).toHaveLength(4);
  });

  it('corta los temas enormes', () => {
    const big = 'palabra '.repeat(MAX_TOPIC_CHARS / 4).trim();
    const chunks = [0, 1, 2].map((i) => chunk(i, i + 1, ['Capítulo I'], big));
    const content = buildTopicContent(topics, chunks, 'cap');
    expect(content?.truncated).toBe(true);
    expect(content?.blocks.length).toBeLessThan(3);
  });
});

describe('estructura del texto', () => {
  it('recupera saltos de línea y tablas del texto de la página', () => {
    const page = 'Encabezado\n1.2 Tablas\np q p∧q\n1 1 1\n1 0 0\nOtro';
    const start = page.indexOf('1.2');
    const end = page.indexOf('\nOtro');
    const [block] = withPageStructure(
      [
        {
          pageNumber: 3,
          sectionPath: ['1.2 Tablas'],
          text: 'plano',
          charStart: start,
          charEnd: end,
        },
      ],
      new Map([[3, page]]),
    );
    expect(block?.text).toBe('1.2 Tablas\np q p∧q\n1 1 1\n1 0 0');
  });

  it('sin texto de página (o con offsets fuera de rango) deja el texto de los fragmentos', () => {
    const block = { pageNumber: 1, sectionPath: [], text: 'plano', charStart: 0, charEnd: 99 };
    expect(withPageStructure([block], new Map())[0]?.text).toBe('plano');
    expect(withPageStructure([block], new Map([[1, 'corto']]))[0]?.text).toBe('plano');
  });
});
