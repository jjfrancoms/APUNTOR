import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  MAX_OCR_PAGES,
  MAX_OCR_SLIDE_IMAGES,
  MultiFormatExtractor,
  parseDocxXml,
  splitTextPages,
} from '../../worker/src/ingestion/extractors';
import { chunkPages } from '../../worker/src/ingestion/pdf-parser';
import { PermanentIngestionError } from '../../worker/src/ingestion/queue-worker';

function fakeOcr(text = 'Texto de la imagen') {
  const calls: string[] = [];
  return {
    calls,
    transcribe(_data: Uint8Array, mimeType: string) {
      calls.push(mimeType);
      return Promise.resolve(text);
    },
  };
}

async function makePdf(pages: readonly (string | null)[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const text of pages) {
    const page = pdf.addPage();
    if (text !== null) page.drawText(text, { x: 50, y: 700, size: 12, font });
  }
  return pdf.save();
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

describe('texto plano', () => {
  it('decide por la extensión declarada y por ser UTF-8 válido', async () => {
    await expect(detectFormat(encode('Apuntes'), 'u/doc.txt')).resolves.toEqual({ kind: 'text' });
    await expect(detectFormat(encode('# Apuntes'), 'u/doc.MD')).resolves.toEqual({ kind: 'text' });
    // Sin extensión de texto, los mismos bytes no son un formato admitido.
    await expect(detectFormat(encode('Apuntes'), 'u/doc.pdf')).rejects.toBeInstanceOf(
      PermanentIngestionError,
    );
    await expect(detectFormat(encode('Apuntes'))).rejects.toBeInstanceOf(PermanentIngestionError);
  });

  it('rechaza binarios y UTF-8 inválido aunque se llamen .txt', async () => {
    for (const bytes of [new Uint8Array([0x61, 0xff, 0xfe]), new Uint8Array([0x61, 0, 0x62])]) {
      await expect(detectFormat(bytes, 'u/doc.txt')).rejects.toBeInstanceOf(
        PermanentIngestionError,
      );
    }
  });

  it('una firma binaria manda sobre la extensión', async () => {
    const pdf = await makePdf(['La mitocondria produce ATP en la celula']);
    await expect(detectFormat(pdf, 'u/doc.txt')).resolves.toEqual({ kind: 'pdf' });
  });

  it('reparte en páginas por párrafos sin partirlos', () => {
    const paragraph = 'palabra '.repeat(50).trim();
    const pages = splitTextPages(Array.from({ length: 8 }, () => paragraph).join('\n\n'), 1000);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(1000);
      for (const part of page.split('\n\n')) expect(part).toBe(paragraph);
    }
  });

  it('corta un párrafo gigante sin perder palabras y sin pasar el límite', () => {
    const words = Array.from({ length: 2000 }, (_, i) => `w${i}`);
    const pages = splitTextPages(words.join(' '), 500);
    expect(pages.every((page) => page.length <= 500)).toBe(true);
    expect(pages.join(' ').split(/\s+/u)).toEqual(words);
  });

  it('respeta los saltos de página y no crea páginas vacías', () => {
    expect(splitTextPages('uno\f\f\r\ndos\f')).toEqual(['uno', 'dos']);
  });

  it('conserva los títulos Markdown como temas, salvo los comentarios de código', async () => {
    const markdown = [
      '# Célula',
      '',
      'La célula es la unidad básica de la vida.',
      '',
      '```python',
      '# Comentario de ejemplo',
      'x = 1',
      '```',
      '',
      '## Mitosis',
      '',
      'División celular.',
    ].join('\n');
    const parsed = await new MultiFormatExtractor(fakeOcr()).extractPages(
      encode(markdown),
      'u/apuntes.md',
    );
    expect(parsed.totalPages).toBe(1);
    const chunks = chunkPages(parsed.pages, { maxTokens: 100, overlapTokens: 0 });
    expect([...new Set(chunks.map((c) => c.sectionPath.join(' > ')))]).toEqual([
      'Célula',
      'Célula > Mitosis',
    ]);
  });

  it('un archivo vacío no tiene páginas', async () => {
    const parsed = await new MultiFormatExtractor(fakeOcr()).extractPages(
      encode('  \n '),
      'u/doc.txt',
    );
    expect(parsed).toEqual({ totalPages: 0, pages: [] });
  });
});

describe('tablas de Word', () => {
  const cell = (...paragraphs: string[]): string =>
    `<w:tc><w:tcPr/>${paragraphs.map((t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')}</w:tc>`;
  const row = (...cells: string[]): string => `<w:tr><w:trPr/>${cells.join('')}</w:tr>`;
  const table = (...rows: string[]): string => `<w:tbl><w:tblPr/>${rows.join('')}</w:tbl>`;
  const paragraph = (text: string): string => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

  it('cada fila es una línea y los párrafos de una celda no se separan', () => {
    const pages = parseDocxXml(
      paragraph('Antes') +
        table(row(cell('p'), cell('q')), row(cell('Dos', 'partes'), cell('a|b'))) +
        paragraph('Después'),
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]?.text.trim().split('\n')).toEqual([
      'Antes',
      '| p | q |',
      '| Dos partes | a\\|b |',
      'Después',
    ]);
  });

  it('las filas nunca se detectan como títulos', () => {
    const pages = parseDocxXml(table(row(cell('Fila que parece título'))));
    expect(pages[0]?.lines).toEqual([]);
  });

  it('una tabla dentro de una celda queda en la fila de afuera', () => {
    const inner = table(row(cell('interior')));
    const pages = parseDocxXml(table(row(`<w:tc>${inner}</w:tc>`, cell('fuera'))));
    expect(pages[0]?.text.trim()).toBe('| interior | fuera |');
  });

  it('el salto guardado antes de una fila la lleva a la página nueva', () => {
    const broken =
      '<w:tc><w:p><w:r><w:lastRenderedPageBreak/><w:t>segunda</w:t></w:r></w:p></w:tc>';
    const pages = parseDocxXml(table(row(cell('primera')), row(broken)));
    expect(pages.map((p) => p.text.trim())).toEqual(['| primera |', '| segunda |']);
  });

  it('un salto en medio de una fila cambia de página al terminarla', () => {
    const broken =
      '<w:tc><w:p><w:r><w:t>empieza</w:t><w:lastRenderedPageBreak/><w:t> sigue</w:t></w:r></w:p></w:tc>';
    const pages = parseDocxXml(table(row(broken)) + paragraph('Luego'));
    expect(pages.map((p) => p.text.trim())).toEqual(['| empieza sigue |', 'Luego']);
  });
});

describe('PPTX: notas e imágenes', () => {
  const NS_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  async function makeDeck(
    slides: readonly { xml: string; rels?: string; files?: Record<string, Uint8Array | string> }[],
  ): Promise<Uint8Array> {
    const zip = new JSZip();
    zip.file(
      'ppt/presentation.xml',
      `<p:presentation><p:sldIdLst>${slides
        .map((_, i) => `<p:sldId id="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</p:sldIdLst></p:presentation>`,
    );
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      `<Relationships>${slides
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${NS_TYPE}/slide" Target="slides/slide${i + 1}.xml"/>`,
        )
        .join('')}</Relationships>`,
    );
    slides.forEach((slide, i) => {
      zip.file(`ppt/slides/slide${i + 1}.xml`, slide.xml);
      if (slide.rels !== undefined) {
        zip.file(
          `ppt/slides/_rels/slide${i + 1}.xml.rels`,
          `<Relationships>${slide.rels}</Relationships>`,
        );
      }
      for (const [name, content] of Object.entries(slide.files ?? {})) zip.file(name, content);
    });
    return zip.generateAsync({ type: 'uint8array' });
  }

  const textSlide = (text: string): string =>
    `<p:sld><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
  const imageSlide = (...ids: string[]): string =>
    `<p:sld>${ids.map((id) => `<a:blip r:embed="${id}"/>`).join('')}</p:sld>`;
  const imageRel = (id: string, file: string): string =>
    `<Relationship Id="${id}" Type="${NS_TYPE}/image" Target="../media/${file}"/>`;
  const notesRel = `<Relationship Id="rN" Type="${NS_TYPE}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>`;
  const notesXml =
    '<p:notes><p:sp><p:nvPr><p:ph type="sldNum"/></p:nvPr><a:p><a:r><a:t>7</a:t></a:r></a:p></p:sp>' +
    '<p:sp><p:nvPr><p:ph type="body" idx="1"/></p:nvPr><a:p><a:r><a:t>Recordar la &amp; regla</a:t></a:r></a:p></p:sp></p:notes>';

  it('añade las notas del orador bajo "Notas:", sin el número de diapositiva', async () => {
    const ocr = fakeOcr();
    const result = await new MultiFormatExtractor(ocr).extractPages(
      await makeDeck([
        {
          xml: textSlide('Contenido'),
          rels: notesRel,
          files: { 'ppt/notesSlides/notesSlide1.xml': notesXml },
        },
      ]),
    );
    expect(result.pages[0]?.text.split('\n').filter(Boolean)).toEqual([
      'Contenido',
      'Notas:',
      'Recordar la & regla',
    ]);
    expect(ocr.calls).toEqual([]);
  });

  it('una diapositiva sin texto pasa sus imágenes por OCR, en orden y con su tipo', async () => {
    const ocr = fakeOcr();
    const result = await new MultiFormatExtractor(ocr).extractPages(
      await makeDeck([
        {
          xml: imageSlide('rB', 'rA', 'rEmf'),
          rels: imageRel('rA', 'a.png') + imageRel('rB', 'b.jpeg') + imageRel('rEmf', 'c.emf'),
          files: {
            'ppt/media/a.png': new Uint8Array([1]),
            'ppt/media/b.jpeg': new Uint8Array([2]),
            'ppt/media/c.emf': new Uint8Array([3]),
          },
        },
      ]),
    );
    expect(ocr.calls).toEqual(['image/jpeg', 'image/png']);
    expect(result.pages[0]?.text).toBe('Texto de la imagen\n\nTexto de la imagen');
    expect(result.pages[0]?.lines).toBeUndefined();
  });

  it('no gasta OCR en una diapositiva con texto ni pasa de las imágenes permitidas', async () => {
    const withText = await makeDeck([
      {
        xml: textSlide('Hay texto').replace('</p:sld>', '<a:blip r:embed="rA"/></p:sld>'),
        rels: imageRel('rA', 'a.png'),
        files: { 'ppt/media/a.png': new Uint8Array([1]) },
      },
    ]);
    const ocrA = fakeOcr();
    await new MultiFormatExtractor(ocrA).extractPages(withText);
    expect(ocrA.calls).toEqual([]);

    const many = await makeDeck(
      Array.from({ length: MAX_OCR_SLIDE_IMAGES + 5 }, (_, i) => ({
        xml: imageSlide('rA'),
        rels: imageRel('rA', `i${i}.png`),
        files: { [`ppt/media/i${i}.png`]: new Uint8Array([1]) },
      })),
    );
    const ocrB = fakeOcr();
    const result = await new MultiFormatExtractor(ocrB).extractPages(many);
    expect(ocrB.calls).toHaveLength(MAX_OCR_SLIDE_IMAGES);
    // Las diapositivas de más siguen existiendo: su número de página no cambia.
    expect(result.totalPages).toBe(MAX_OCR_SLIDE_IMAGES + 5);
  });
});

describe('tope de OCR', () => {
  it('un PDF con demasiadas páginas escaneadas falla sin gastar ninguna llamada', async () => {
    const ocr = fakeOcr();
    const pdf = await makePdf(Array.from({ length: MAX_OCR_PAGES + 1 }, () => null));
    const failure = new MultiFormatExtractor(ocr).extractPages(pdf);
    await expect(failure).rejects.toBeInstanceOf(PermanentIngestionError);
    await expect(failure).rejects.toThrow(`máximo con OCR es ${MAX_OCR_PAGES}`);
    expect(ocr.calls).toEqual([]);
  }, 30_000);

  it('justo en el tope sí se procesa', async () => {
    const ocr = fakeOcr();
    const pdf = await makePdf(Array.from({ length: MAX_OCR_PAGES }, () => null));
    await new MultiFormatExtractor(ocr).extractPages(pdf);
    expect(ocr.calls).toHaveLength(MAX_OCR_PAGES);
  }, 30_000);
});
