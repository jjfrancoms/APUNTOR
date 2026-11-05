import { describe, expect, it } from 'vitest';
import {
  chunkPages,
  defaultHeadingDetector,
  normalizePageText,
  type PageText,
} from '../../worker/src/ingestion/pdf-parser';

/** 1 palabra = 1 token: hace los tests deterministas e independientes de la heurística. */
const countWords = (text: string): number => text.split(/\s+/u).filter(Boolean).length;

function words(prefix: string, n: number): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('chunkPages', () => {
  it('conserva el page_number exacto y nunca mezcla páginas en un chunk', () => {
    const pages: PageText[] = [
      { pageNumber: 1, text: words('a', 25) },
      { pageNumber: 2, text: words('b', 25) },
      { pageNumber: 3, text: words('c', 5) },
    ];
    const chunks = chunkPages(pages, { maxTokens: 10, overlapTokens: 3, countTokens: countWords });

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      const prefix = { 1: 'a', 2: 'b', 3: 'c' }[chunk.pageNumber];
      expect(prefix).toBeDefined();
      for (const w of chunk.content.split(' ')) expect(w.startsWith(prefix ?? '?')).toBe(true);
      expect(chunk.tokenCount).toBeLessThanOrEqual(10);
    }
    expect(new Set(chunks.map((c) => c.pageNumber))).toEqual(new Set([1, 2, 3]));
  });

  it('aplica solapamiento entre chunks consecutivos de la misma página', () => {
    const chunks = chunkPages([{ pageNumber: 7, text: words('w', 20) }], {
      maxTokens: 8,
      overlapTokens: 3,
      countTokens: countWords,
    });
    const [first, second] = chunks;
    expect(first?.content.split(' ').slice(-3)).toEqual(second?.content.split(' ').slice(0, 3));
    // Cobertura completa: la última palabra del texto está en el último chunk.
    expect(chunks.at(-1)?.content.endsWith('w19')).toBe(true);
  });

  it('numera chunk_index de forma global y consecutiva', () => {
    const chunks = chunkPages(
      [
        { pageNumber: 2, text: words('x', 12) },
        { pageNumber: 1, text: words('y', 12) },
      ],
      { maxTokens: 5, overlapTokens: 1, countTokens: countWords },
    );
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    // Las páginas se procesan en orden aunque lleguen desordenadas.
    expect(chunks[0]?.pageNumber).toBe(1);
  });

  it('omite páginas vacías sin desplazar la numeración de las demás', () => {
    const chunks = chunkPages(
      [
        { pageNumber: 1, text: '   \n  ' },
        { pageNumber: 2, text: 'contenido real' },
      ],
      { maxTokens: 50, overlapTokens: 0, countTokens: countWords },
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.pageNumber).toBe(2);
  });

  it('asigna metadatos de sección y los arrastra a la página siguiente', () => {
    const pages: PageText[] = [
      {
        pageNumber: 1,
        text: '1. Biología celular\nLa célula es la unidad básica.\n1.1 Mitosis\nDivisión.',
      },
      { pageNumber: 2, text: 'Continúa la mitosis en profase.\n2. Genética\nADN.' },
    ];
    const chunks = chunkPages(pages, { maxTokens: 100, overlapTokens: 0, countTokens: countWords });

    expect(chunks.map((c) => [c.pageNumber, c.sectionTitle])).toEqual([
      [1, '1. Biología celular'],
      [1, '1.1 Mitosis'],
      [2, '1.1 Mitosis'],
      [2, '2. Genética'],
    ]);
    expect(chunks[1]?.sectionPath).toEqual(['1. Biología celular', '1.1 Mitosis']);
    expect(chunks[3]?.sectionPath).toEqual(['2. Genética']);
  });

  it('registra offsets que apuntan al texto normalizado de la página', () => {
    const text = 'Primera línea\nsegunda línea con más texto';
    const [chunk] = chunkPages([{ pageNumber: 1, text }], {
      maxTokens: 100,
      overlapTokens: 0,
      countTokens: countWords,
    });
    const normalized = normalizePageText(text);
    expect(chunk).toBeDefined();
    expect(normalized.slice(chunk?.charStart, chunk?.charEnd).replace(/\s+/gu, ' ')).toBe(
      chunk?.content,
    );
  });

  it('valida las opciones', () => {
    expect(() => chunkPages([], { maxTokens: 0, overlapTokens: 0 })).toThrow(RangeError);
    expect(() => chunkPages([], { maxTokens: 10, overlapTokens: 10 })).toThrow(RangeError);
    expect(() =>
      chunkPages([{ pageNumber: 0, text: 'x' }], { maxTokens: 10, overlapTokens: 0 }),
    ).toThrow(RangeError);
  });

  it('mantiene la trazabilidad en un documento de 120 páginas', () => {
    const pages = Array.from({ length: 120 }, (_, i) => ({
      pageNumber: i + 1,
      text: words(`p${i + 1}w`, 300),
    }));
    const chunks = chunkPages(pages, {
      maxTokens: 120,
      overlapTokens: 20,
      countTokens: countWords,
    });
    for (const chunk of chunks) {
      expect(chunk.content.split(' ').every((w) => w.startsWith(`p${chunk.pageNumber}w`))).toBe(
        true,
      );
    }
    expect(new Set(chunks.map((c) => c.pageNumber)).size).toBe(120);
  });
});

describe('normalizePageText', () => {
  it('une palabras partidas por guion de fin de línea y colapsa espacios', () => {
    expect(normalizePageText('foto-\nsíntesis   en  la\r\nhoja')).toBe('fotosíntesis en la\nhoja');
  });
});

describe('defaultHeadingDetector', () => {
  it.each([
    ['2.3.1 Fases de la mitosis', 3],
    ['Capítulo 4', 1],
    ['INTRODUCCIÓN', 1],
  ])('detecta "%s" como encabezado de nivel %i', (line, level) => {
    expect(defaultHeadingDetector(line)).toBe(level);
  });

  it.each([
    'La célula es la unidad básica de la vida.',
    '3 manzanas, 2 peras y una naranja.',
    'ADN',
  ])('no confunde texto normal con encabezado: "%s"', (line) => {
    expect(defaultHeadingDetector(line)).toBeNull();
  });
});
