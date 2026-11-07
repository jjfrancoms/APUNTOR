import JSZip from 'jszip';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  MultiFormatExtractor,
  parseDocxXml,
} from '../../worker/src/ingestion/extractors';
import { PermanentIngestionError } from '../../worker/src/ingestion/queue-worker';

const LONG_TEXT = 'La mitocondria produce ATP en la celula';

function fakeOcr(text = 'Texto del cuaderno escaneado') {
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

async function makeDocx(body: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('word/document.xml', `<w:document><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

async function makePptx(): Promise<Uint8Array> {
  const zip = new JSZip();
  // El orden de la presentación es el contrario al de los nombres de archivo.
  zip.file(
    'ppt/presentation.xml',
    '<p:presentation><p:sldIdLst><p:sldId id="1" r:id="rId2"/><p:sldId id="2" r:id="rId1"/></p:sldIdLst></p:presentation>',
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    '<Relationships><Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="slide" Target="slides/slide2.xml"/></Relationships>',
  );
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>Segunda</a:t></a:r></a:p></p:sld>');
  zip.file(
    'ppt/slides/slide2.xml',
    '<p:sld><a:p><a:r><a:t>Primera &amp; más</a:t></a:r></a:p></p:sld>',
  );
  return zip.generateAsync({ type: 'uint8array' });
}

describe('detectFormat', () => {
  it('reconoce el formato por el contenido', async () => {
    expect(await detectFormat(await makePdf(['a']))).toEqual({ kind: 'pdf' });
    expect(await detectFormat(await makeDocx(''))).toEqual({ kind: 'docx' });
    expect(await detectFormat(await makePptx())).toEqual({ kind: 'pptx' });
    expect(await detectFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      kind: 'image',
      mimeType: 'image/jpeg',
    });
    expect(await detectFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({
      kind: 'image',
      mimeType: 'image/png',
    });
  });

  it('un archivo de otro tipo es un error permanente, aunque se llame .pdf', async () => {
    const data = new TextEncoder().encode('esto es texto plano');
    await expect(detectFormat(data)).rejects.toBeInstanceOf(PermanentIngestionError);
  });

  it('un ZIP cualquiera tampoco se acepta', async () => {
    const zip = new JSZip();
    zip.file('a.txt', 'hola');
    const data = await zip.generateAsync({ type: 'uint8array' });
    await expect(detectFormat(data)).rejects.toBeInstanceOf(PermanentIngestionError);
  });
});

describe('PDF', () => {
  it('lee el texto por página sin gastar OCR', async () => {
    const ocr = fakeOcr();
    const result = await new MultiFormatExtractor(ocr).extractPages(
      await makePdf([LONG_TEXT, `${LONG_TEXT} dos`]),
    );
    expect(result.totalPages).toBe(2);
    expect(result.pages[1]?.pageNumber).toBe(2);
    expect(result.pages[1]?.text).toContain('dos');
    expect(ocr.calls).toEqual([]);
  });

  it('pasa por OCR solo las páginas escaneadas y conserva su número', async () => {
    const ocr = fakeOcr();
    const result = await new MultiFormatExtractor(ocr).extractPages(
      await makePdf([LONG_TEXT, null, LONG_TEXT]),
    );
    expect(ocr.calls).toEqual(['application/pdf']);
    expect(result.pages[1]).toEqual({ pageNumber: 2, text: 'Texto del cuaderno escaneado' });
    expect(result.pages[0]?.text).toContain('mitocondria');
    expect(result.pages[2]?.text).toContain('mitocondria');
  });
});

describe('imágenes', () => {
  it('una foto es una página transcrita con OCR', async () => {
    const ocr = fakeOcr();
    const result = await new MultiFormatExtractor(ocr).extractPages(
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    );
    expect(ocr.calls).toEqual(['image/jpeg']);
    expect(result).toEqual({
      totalPages: 1,
      pages: [{ pageNumber: 1, text: 'Texto del cuaderno escaneado' }],
    });
  });
});

describe('DOCX', () => {
  it('separa páginas con los saltos guardados por Word y decodifica entidades', () => {
    const pages = parseDocxXml(
      '<w:p><w:r><w:t>Uno &amp; dos</w:t></w:r></w:p>' +
        '<w:p><w:r><w:lastRenderedPageBreak/><w:t xml:space="preserve">Tres</w:t></w:r></w:p>' +
        '<w:p><w:r><w:br w:type="page"/><w:t>Cuatro</w:t></w:r></w:p>',
    );
    expect(pages.map((p) => [p.pageNumber, p.text.trim()])).toEqual([
      [1, 'Uno & dos'],
      [2, 'Tres'],
      [3, 'Cuatro'],
    ]);
  });

  it('un salto de línea normal no cuenta como página', () => {
    expect(parseDocxXml('<w:p><w:r><w:br/><w:t>Hola</w:t></w:r></w:p>')).toHaveLength(1);
  });

  it('extrae el archivo completo', async () => {
    const result = await new MultiFormatExtractor(fakeOcr()).extractPages(
      await makeDocx('<w:p><w:r><w:t>Hola</w:t></w:r></w:p>'),
    );
    expect(result.pages[0]?.text.trim()).toBe('Hola');
  });
});

describe('PPTX', () => {
  it('cada diapositiva es una página, en el orden de la presentación', async () => {
    const result = await new MultiFormatExtractor(fakeOcr()).extractPages(await makePptx());
    expect(result.pages.map((p) => [p.pageNumber, p.text.trim()])).toEqual([
      [1, 'Primera & más'],
      [2, 'Segunda'],
    ]);
  });
});
