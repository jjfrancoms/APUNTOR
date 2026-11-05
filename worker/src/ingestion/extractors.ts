import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import type { OcrProvider } from '../../../api/src/llm/vertex';
import type { DocumentExtractor, PageText, ParsedDocument } from './pdf-parser';
import { PermanentIngestionError } from './queue-worker';

export type DocumentFormat =
  { kind: 'pdf' } | { kind: 'docx' } | { kind: 'pptx' } | { kind: 'image'; mimeType: string };

/** Límite por entrada del ZIP: un archivo de 50 MB no debe expandirse sin freno. */
const MAX_ZIP_ENTRY_BYTES = 200 * 1024 * 1024;
/** Una página con menos texto que esto se considera escaneada y pasa por OCR. */
const MIN_PAGE_TEXT_CHARS = 20;

function startsWith(data: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  return bytes.every((byte, i) => data[offset + i] === byte);
}

function ascii(data: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...data.subarray(start, end));
}

/** Lee por partes y corta al pasar el límite, sin descomprimir el resto. */
function readZipEntry(entry: JSZip.JSZipObject): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const stream = entry.nodeStream();
    stream.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_ZIP_ENTRY_BYTES) {
        stream.pause();
        reject(new PermanentIngestionError('El documento es demasiado grande al descomprimirlo'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

/** Identifica el formato por su contenido: la extensión la elige quien sube el archivo. */
export async function detectFormat(data: Uint8Array): Promise<DocumentFormat> {
  if (startsWith(data, [0x25, 0x50, 0x44, 0x46])) return { kind: 'pdf' };
  if (startsWith(data, [0xff, 0xd8, 0xff])) return { kind: 'image', mimeType: 'image/jpeg' };
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', mimeType: 'image/png' };
  if (ascii(data, 4, 8) === 'ftyp' && ['heic', 'heix', 'mif1'].includes(ascii(data, 8, 12))) {
    return { kind: 'image', mimeType: 'image/heic' };
  }
  if (startsWith(data, [0x50, 0x4b, 0x03, 0x04])) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch {
      throw new PermanentIngestionError('El archivo está dañado');
    }
    if (zip.file('word/document.xml')) return { kind: 'docx' };
    if (zip.file('ppt/presentation.xml')) return { kind: 'pptx' };
  }
  throw new PermanentIngestionError('Formato de archivo no admitido');
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}

/**
 * Word no guarda páginas fijas: se usan los saltos que dejó al guardar
 * (`lastRenderedPageBreak`) y los manuales. Si el archivo no trae ninguno (lo generó otro
 * programa), todo queda en la página 1, así que la cita de un DOCX es aproximada.
 */
export function parseDocxXml(xml: string): PageText[] {
  const pages: string[] = [];
  let current = '';
  const addText = (text: string): void => {
    current += text;
  };
  const tokens =
    /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:lastRenderedPageBreak\s*\/>|<w:br\s[^>]*w:type="page"[^>]*\/>|<w:tab\s*\/>|<\/w:p>/gu;
  for (const match of xml.matchAll(tokens)) {
    const token = match[0];
    if (match[1] !== undefined) addText(decodeXml(match[1]));
    else if (token.startsWith('<w:tab')) addText(' ');
    else if (token === '</w:p>') addText('\n');
    else {
      pages.push(current);
      current = '';
    }
  }
  pages.push(current);
  return pages.map((text, i) => ({ pageNumber: i + 1, text }));
}

async function extractDocx(data: Uint8Array): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new PermanentIngestionError('El archivo DOCX está dañado');
  const pages = parseDocxXml(await readZipEntry(entry));
  return { totalPages: pages.length, pages };
}

function parseSlideXml(xml: string): string {
  let text = '';
  for (const match of xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>|<\/a:p>/gu)) {
    text += match[1] === undefined ? '\n' : decodeXml(match[1]);
  }
  return text;
}

/** Cada diapositiva es una página, en el orden de la presentación (no el de los archivos). */
async function extractPptx(data: Uint8Array): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const presentation = zip.file('ppt/presentation.xml');
  const rels = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presentation || !rels) throw new PermanentIngestionError('El archivo PPTX está dañado');

  const targets = new Map<string, string>();
  for (const tag of (await readZipEntry(rels)).match(/<Relationship\s[^>]*>/gu) ?? []) {
    const id = /\bId="([^"]+)"/u.exec(tag)?.[1];
    const target = /\bTarget="([^"]+)"/u.exec(tag)?.[1];
    if (id !== undefined && target !== undefined) targets.set(id, target);
  }

  const pages: PageText[] = [];
  const slideIds = (await readZipEntry(presentation)).matchAll(/<p:sldId\s[^>]*r:id="([^"]+)"/gu);
  for (const [, relationshipId] of slideIds) {
    const target = targets.get(relationshipId ?? '');
    const slide = target === undefined ? null : zip.file(`ppt/${target.replace(/^\/?ppt\//u, '')}`);
    if (slide) {
      pages.push({ pageNumber: pages.length + 1, text: parseSlideXml(await readZipEntry(slide)) });
    }
  }
  return { totalPages: pages.length, pages };
}

async function extractPdf(data: Uint8Array, ocr: OcrProvider): Promise<ParsedDocument> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  // pdf.js se queda con el buffer que recibe: se le pasa una copia para poder partir el PDF.
  const pdf = await getDocumentProxy(data.slice());
  let totalPages: number;
  let texts: string[];
  try {
    ({ totalPages, text: texts } = await extractText(pdf, { mergePages: false }));
  } finally {
    await pdf.loadingTask.destroy();
  }

  const pages: PageText[] = texts.map((text, i) => ({ pageNumber: i + 1, text }));
  const scanned = pages.filter((page) => page.text.trim().length < MIN_PAGE_TEXT_CHARS);
  if (scanned.length === 0) return { totalPages, pages };

  const source = await PDFDocument.load(data, { ignoreEncryption: true });
  // Página por página y en orden: el número de página de la cita no depende del modelo.
  for (const page of scanned) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(source, [page.pageNumber - 1]);
    if (copied) single.addPage(copied);
    const transcribed = await ocr.transcribe(await single.save(), 'application/pdf');
    if (transcribed.trim().length > 0) page.text = transcribed;
  }
  return { totalPages, pages };
}

export class MultiFormatExtractor implements DocumentExtractor {
  constructor(private readonly ocr: OcrProvider) {}

  async extractPages(data: Uint8Array): Promise<ParsedDocument> {
    const format = await detectFormat(data);
    switch (format.kind) {
      case 'pdf':
        return extractPdf(data, this.ocr);
      case 'docx':
        return extractDocx(data);
      case 'pptx':
        return extractPptx(data);
      case 'image':
        return {
          totalPages: 1,
          pages: [{ pageNumber: 1, text: await this.ocr.transcribe(data, format.mimeType) }],
        };
    }
  }
}
