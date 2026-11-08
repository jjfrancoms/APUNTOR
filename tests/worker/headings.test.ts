import { describe, expect, it } from 'vitest';
import {
  detectStyledHeadings,
  headingKey,
  looksLikeTitle,
  numberingDepth,
  type StyledLine,
} from '../../worker/src/ingestion/headings';
import { parseDocxStyles, parseDocxXml, slideTitle } from '../../worker/src/ingestion/extractors';
import { chunkPages } from '../../worker/src/ingestion/pdf-parser';

const body = (text: string): StyledLine => ({ text, size: 12 });
const LONG = 'La proposición es un enunciado que puede ser verdadero o falso según el caso.';

describe('looksLikeTitle', () => {
  it.each(['0 0 1', '1 1 0 1', 'V V F F', 'p → q', 'n n', '12', 'P ∧ Q'])(
    'descarta filas de tabla, fórmulas y números: "%s"',
    (line) => {
      expect(looksLikeTitle(line)).toBe(false);
    },
  );
  it.each(['1.2 Tablas de verdad', 'Ejemplos', 'Tema 3. Lógica de predicados', 'ADN y ARN'])(
    'acepta títulos reales: "%s"',
    (line) => {
      expect(looksLikeTitle(line)).toBe(true);
    },
  );
});

describe('numberingDepth', () => {
  it('cuenta los niveles de la numeración y las palabras clave', () => {
    expect(numberingDepth('2.3.1 Mitosis')).toBe(3);
    expect(numberingDepth('Tema 1. Proposiciones')).toBe(1);
    expect(numberingDepth('Ejemplos')).toBe(0);
  });
});

describe('detectStyledHeadings', () => {
  it('usa el tamaño de letra: más grande es más general y la numeración baja de nivel', () => {
    const map = detectStyledHeadings([
      {
        pageNumber: 1,
        lines: [
          { text: 'Curso de lógica', size: 10 },
          { text: 'Capítulo I', size: 24 },
          { text: 'Lógica proposicional', size: 24 },
          { text: 'Tema 1. Proposiciones', size: 14 },
          { text: '1.1 Definiciones básicas', size: 14 },
          body(LONG),
          body(LONG),
          body('0 0 1'),
        ],
      },
      { pageNumber: 2, lines: [{ text: 'Curso de lógica', size: 10 }, body(LONG)] },
      { pageNumber: 3, lines: [{ text: 'Curso de lógica', size: 10 }, body(LONG)] },
    ]);
    const page = map?.get(1);
    expect(page?.get(headingKey('Capítulo I'))).toEqual({
      level: 1,
      title: 'Capítulo I Lógica proposicional',
      continuation: false,
    });
    expect(page?.get(headingKey('Lógica proposicional'))?.continuation).toBe(true);
    expect(page?.get(headingKey('Tema 1. Proposiciones'))?.level).toBe(2);
    expect(page?.get(headingKey('1.1 Definiciones básicas'))?.level).toBe(3);
    expect(page?.get(headingKey('0 0 1'))).toBeUndefined();
    expect(page?.get(headingKey('Curso de lógica'))).toBeUndefined();
  });

  it('reconoce títulos marcados solo con negrita o color', () => {
    const map = detectStyledHeadings([
      {
        pageNumber: 1,
        lines: [
          { text: 'Fotosíntesis', size: 12, bold: true },
          body(LONG),
          { text: 'Fase luminosa', size: 12, color: 'c00000' },
          body(LONG),
          body(LONG),
        ],
      },
    ]);
    expect(map?.get(1)?.get(headingKey('Fotosíntesis'))).toBeDefined();
    expect(map?.get(1)?.get(headingKey('Fase luminosa'))).toBeDefined();
  });

  it('sin diferencias de formato devuelve null (se usa la detección por texto)', () => {
    expect(
      detectStyledHeadings([{ pageNumber: 1, lines: [body(LONG), body('Corto')] }]),
    ).toBeNull();
  });

  it('un estilo que cubre mucho texto no es de títulos', () => {
    const bold = { text: LONG, size: 12, bold: true };
    expect(detectStyledHeadings([{ pageNumber: 1, lines: [bold, bold, body(LONG)] }])).toBeNull();
  });
});

describe('Word con formato', () => {
  it('lee tamaño, negrita y color de cada párrafo, y los estilos de título', () => {
    const styles = parseDocxStyles(
      '<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/></w:style></w:styles>',
    );
    const [page] = parseDocxXml(
      '<w:p><w:pPr><w:pStyle w:val="Ttulo1"/></w:pPr><w:r><w:t>Introducción</w:t></w:r></w:p>' +
        '<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1F4E79"/></w:rPr><w:t>La célula</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>Texto normal.</w:t></w:r></w:p>',
      styles,
    );
    expect(page?.lines).toEqual([
      { text: 'Introducción', size: 11, outlineLevel: 1 },
      { text: 'La célula', size: 16, bold: true, color: '1f4e79' },
      { text: 'Texto normal.', size: 11 },
    ]);
  });
});

describe('PowerPoint', () => {
  it('el cuadro de título de la diapositiva es su tema', () => {
    expect(
      slideTitle(
        '<p:sld><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Mitosis</a:t></a:r></a:p></p:txBody></p:sp></p:sld>',
      ),
    ).toBe('Mitosis');
    expect(
      slideTitle('<p:sld><p:sp><a:p><a:r><a:t>Sin título</a:t></a:r></a:p></p:sp></p:sld>'),
    ).toBeNull();
  });
});

describe('chunkPages con títulos por formato', () => {
  it('no convierte en temas las filas de una tabla de verdad ni el encabezado repetido', () => {
    const page = (n: number, extra: StyledLine[]) => {
      const lines = [{ text: 'Lógica I', size: 10 }, ...extra, body(LONG)];
      return { pageNumber: n, text: lines.map((l) => l.text).join('\n'), lines };
    };
    const chunks = chunkPages(
      [
        page(1, [{ text: '1.2 Tablas de verdad', size: 14 }, body('0 0 1'), body('1 1 0')]),
        page(2, []),
        page(3, [{ text: '1.3 Operadores', size: 14 }]),
      ],
      { maxTokens: 400, overlapTokens: 20 },
    );
    // El encabezado de página que va antes del primer título queda sin sección (null).
    expect([...new Set(chunks.map((c) => c.sectionTitle).filter(Boolean))]).toEqual([
      '1.2 Tablas de verdad',
      '1.3 Operadores',
    ]);
  });

  it('sin formato, la detección por texto ignora las tablas de verdad', () => {
    const text = ['1.2 Tablas de verdad', '0 0 1', '1 1 0', 'V V F F', LONG].join('\n');
    const chunks = chunkPages([{ pageNumber: 1, text }], { maxTokens: 400, overlapTokens: 20 });
    expect([...new Set(chunks.map((c) => c.sectionTitle))]).toEqual(['1.2 Tablas de verdad']);
  });

  it('reconoce los títulos que marca el OCR con #', () => {
    const chunks = chunkPages([{ pageNumber: 1, text: `# Mitosis\n${LONG}` }], {
      maxTokens: 400,
      overlapTokens: 20,
    });
    expect(chunks[0]?.sectionTitle).toBe('Mitosis');
  });
});
