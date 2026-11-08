import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import type { OcrProvider } from '../../../api/src/llm/vertex';
import type { StyledLine } from './headings';
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

interface RunFormat {
  size?: number;
  bold?: boolean;
  color?: string;
}

interface DocxStyle extends RunFormat {
  basedOn?: string;
  outlineLevel?: number;
}

/** Estilos de Word (`word/styles.xml`): formato por estilo y el formato por defecto. */
export interface DocxStyles {
  defaults: RunFormat;
  styles: Map<string, DocxStyle>;
}

const attr = (xml: string, tag: string): string | undefined =>
  new RegExp(`<w:${tag}\\b[^>]*\\bw:val="([^"]*)"`, 'u').exec(xml)?.[1];

/** Formato de un `<w:rPr>` (tamaño en puntos; Word lo guarda en medios puntos). */
function readRunFormat(rPr: string): RunFormat {
  const format: RunFormat = {};
  const size = attr(rPr, 'sz');
  if (size !== undefined && Number(size) > 0) format.size = Number(size) / 2;
  const bold = /<w:b(?:\s[^>]*)?\/>/u.exec(rPr)?.[0];
  if (bold !== undefined) format.bold = !/w:val="(0|false|off)"/u.test(bold);
  const color = attr(rPr, 'color');
  if (color !== undefined && /^[0-9a-f]{6}$/iu.test(color) && color.toLowerCase() !== '000000') {
    format.color = color.toLowerCase();
  }
  return format;
}

const HEADING_STYLE = /^(?:heading|t[ií]tulo|ttulo|berschrift|titre)\s*(\d)$/iu;

export function parseDocxStyles(xml: string): DocxStyles {
  const rPrDefault = /<w:rPrDefault>([\s\S]*?)<\/w:rPrDefault>/u.exec(xml)?.[1] ?? '';
  const styles = new Map<string, DocxStyle>();
  for (const match of xml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/gu)) {
    const id = /w:styleId="([^"]+)"/u.exec(match[1] ?? '')?.[1];
    const body = match[2] ?? '';
    if (id === undefined) continue;
    const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/u.exec(body)?.[1] ?? '';
    const style: DocxStyle = readRunFormat(rPr);
    const basedOn = attr(body, 'basedOn');
    if (basedOn !== undefined) style.basedOn = basedOn;
    const outline = attr(body, 'outlineLvl');
    const name = attr(body, 'name') ?? '';
    const byName = HEADING_STYLE.exec(id) ?? HEADING_STYLE.exec(name.replace(/\s+/gu, ''));
    if (outline !== undefined && Number(outline) < 9) style.outlineLevel = Number(outline) + 1;
    else if (byName?.[1] !== undefined) style.outlineLevel = Number(byName[1]);
    else if (/^(title|t[ií]tulo|ttulo)$/iu.test(id)) style.outlineLevel = 1;
    styles.set(id, style);
  }
  return {
    defaults: readRunFormat(/<w:rPr>([\s\S]*?)<\/w:rPr>/u.exec(rPrDefault)?.[1] ?? ''),
    styles,
  };
}

/** Formato efectivo de un estilo, siguiendo la cadena `basedOn`. */
function resolveStyle(styles: DocxStyles, id: string | undefined): DocxStyle {
  const chain: DocxStyle[] = [];
  const seen = new Set<string>();
  let current = id;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const style = styles.styles.get(current);
    if (!style) break;
    chain.unshift(style);
    current = style.basedOn;
  }
  return chain.reduce<DocxStyle>((acc, style) => ({ ...acc, ...style }), {});
}

const EMPTY_STYLES: DocxStyles = { defaults: {}, styles: new Map() };

/**
 * Word no guarda páginas fijas: se usan los saltos que dejó al guardar
 * (`lastRenderedPageBreak`) y los manuales. Si el archivo no trae ninguno (lo generó otro
 * programa), todo queda en la página 1, así que la cita de un DOCX es aproximada.
 * Cada párrafo es una línea con su formato (tamaño, negrita, color, estilo de título).
 */
export function parseDocxXml(xml: string, styles: DocxStyles = EMPTY_STYLES): PageText[] {
  const pages: PageText[] = [];
  let text = '';
  let lines: StyledLine[] = [];
  const newPage = (): void => {
    pages.push({ pageNumber: pages.length + 1, text, lines });
    text = '';
    lines = [];
  };

  for (const paragraph of xml.matchAll(/<w:p\b(?!Pr)[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/gu)) {
    const body = paragraph[1] ?? '';
    const pPr = /<w:pPr>([\s\S]*?)<\/w:pPr>/u.exec(body)?.[1] ?? '';
    const pStyle = resolveStyle(styles, attr(pPr, 'pStyle'));
    const outline = attr(pPr, 'outlineLvl');
    const outlineLevel =
      outline !== undefined && Number(outline) < 9 ? Number(outline) + 1 : pStyle.outlineLevel;

    let lineText = '';
    const weights = {
      size: new Map<number, number>(),
      bold: 0,
      color: new Map<string, number>(),
      chars: 0,
    };
    const pushLine = (): void => {
      const line: StyledLine = { text: lineText };
      let best = -1;
      for (const [size, w] of weights.size) {
        if (w > best) {
          line.size = size;
          best = w;
        }
      }
      if (weights.chars > 0 && weights.bold / weights.chars >= 0.9) line.bold = true;
      for (const [color, w] of weights.color) {
        if (w / Math.max(1, weights.chars) >= 0.9) line.color = color;
      }
      if (outlineLevel !== undefined) line.outlineLevel = outlineLevel;
      if (lineText.trim().length > 0) lines.push(line);
      lineText = '';
      weights.size.clear();
      weights.color.clear();
      weights.bold = 0;
      weights.chars = 0;
    };

    for (const run of body.matchAll(/<w:r\b(?![A-Za-z])[^>]*>([\s\S]*?)<\/w:r>/gu)) {
      const runBody = run[1] ?? '';
      const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/u.exec(runBody)?.[1] ?? '';
      const format: RunFormat = {
        ...styles.defaults,
        ...pStyle,
        ...resolveStyle(styles, attr(rPr, 'rStyle')),
        ...readRunFormat(rPr),
      };
      const tokens =
        /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:lastRenderedPageBreak\s*\/>|<w:br\s[^>]*w:type="page"[^>]*\/>|<w:tab\s*\/>/gu;
      for (const match of runBody.matchAll(tokens)) {
        const token = match[0];
        if (match[1] !== undefined) {
          const piece = decodeXml(match[1]);
          text += piece;
          lineText += piece;
          const chars = piece.trim().length;
          weights.chars += chars;
          if (format.size !== undefined) {
            weights.size.set(format.size, (weights.size.get(format.size) ?? 0) + chars);
          }
          if (format.bold === true) weights.bold += chars;
          if (format.color !== undefined) {
            weights.color.set(format.color, (weights.color.get(format.color) ?? 0) + chars);
          }
        } else if (token.startsWith('<w:tab')) {
          text += ' ';
          lineText += ' ';
        } else {
          pushLine();
          newPage();
        }
      }
    }
    pushLine();
    text += '\n';
  }
  newPage();
  return pages;
}

async function extractDocx(data: Uint8Array): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new PermanentIngestionError('El archivo DOCX está dañado');
  const stylesEntry = zip.file('word/styles.xml');
  const styles = stylesEntry ? parseDocxStyles(await readZipEntry(stylesEntry)) : EMPTY_STYLES;
  const pages = parseDocxXml(await readZipEntry(entry), styles);
  return { totalPages: pages.length, pages };
}

function parseSlideXml(xml: string): string {
  let text = '';
  for (const match of xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>|<\/a:p>/gu)) {
    text += match[1] === undefined ? '\n' : decodeXml(match[1]);
  }
  return text;
}

/** Primer párrafo del cuadro de título de la diapositiva (si tiene). */
export function slideTitle(xml: string): string | null {
  for (const shape of xml.matchAll(/<p:sp\b[^>]*>([\s\S]*?)<\/p:sp>/gu)) {
    const body = shape[1] ?? '';
    if (!/<p:ph\b[^>]*type="(?:title|ctrTitle)"/u.test(body)) continue;
    for (const paragraph of body.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gu)) {
      const text = parseSlideXml(paragraph[1] ?? '').trim();
      if (text.length > 0) return text;
    }
  }
  return null;
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
      const xml = await readZipEntry(slide);
      const title = slideTitle(xml);
      pages.push({
        pageNumber: pages.length + 1,
        text: parseSlideXml(xml),
        lines: title === null ? [] : [{ text: title, outlineLevel: 1 }],
      });
    }
  }
  return { totalPages: pages.length, pages };
}

interface PdfTextItem {
  str: string;
  transform: number[];
  hasEOL: boolean;
}

/** Líneas de una página de PDF con el tamaño de letra que más texto cubre en cada una. */
export function pdfStyledLines(items: readonly unknown[]): StyledLine[] {
  const lines: StyledLine[] = [];
  let text = '';
  const weights = new Map<number, number>();
  const flush = (): void => {
    let size: number | undefined;
    let best = -1;
    for (const [s, w] of weights) {
      if (w > best) {
        size = s;
        best = w;
      }
    }
    lines.push(size === undefined ? { text } : { text, size });
    text = '';
    weights.clear();
  };
  for (const raw of items) {
    if (typeof raw !== 'object' || raw === null || !('str' in raw)) continue;
    const item = raw as PdfTextItem;
    text += item.str;
    const [, , c = 0, d = 0] = item.transform;
    const size = Math.round(Math.hypot(c, d) * 2) / 2;
    const chars = item.str.trim().length;
    if (chars > 0 && size > 0) weights.set(size, (weights.get(size) ?? 0) + chars);
    if (item.hasEOL) flush();
  }
  if (text.length > 0) flush();
  return lines;
}

async function extractPdf(data: Uint8Array, ocr: OcrProvider): Promise<ParsedDocument> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  // pdf.js se queda con el buffer que recibe: se le pasa una copia para poder partir el PDF.
  const pdf = await getDocumentProxy(data.slice());
  let totalPages: number;
  let texts: string[];
  const styled: StyledLine[][] = [];
  try {
    ({ totalPages, text: texts } = await extractText(pdf, { mergePages: false }));
    for (let n = 1; n <= totalPages; n += 1) {
      const content = await (await pdf.getPage(n)).getTextContent();
      styled.push(pdfStyledLines(content.items));
    }
  } finally {
    await pdf.loadingTask.destroy();
  }

  const pages: PageText[] = texts.map((text, i) => ({
    pageNumber: i + 1,
    text,
    lines: styled[i] ?? [],
  }));
  const scanned = pages.filter((page) => page.text.trim().length < MIN_PAGE_TEXT_CHARS);
  if (scanned.length === 0) return { totalPages, pages };

  const source = await PDFDocument.load(data, { ignoreEncryption: true });
  // Página por página y en orden: el número de página de la cita no depende del modelo.
  for (const page of scanned) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(source, [page.pageNumber - 1]);
    if (copied) single.addPage(copied);
    const transcribed = await ocr.transcribe(await single.save(), 'application/pdf');
    if (transcribed.trim().length > 0) {
      page.text = transcribed;
      // El texto del OCR no trae formato: sus títulos se detectan por texto ("# Título").
      delete page.lines;
    }
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
