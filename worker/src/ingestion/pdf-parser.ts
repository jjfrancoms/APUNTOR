/**
 * Extracción de texto página a página y chunking con solapamiento.
 *
 * Invariante clave: cada chunk pertenece a UNA sola página. El solapamiento
 * se aplica dentro de la página (y dentro de la sección), nunca cruzando el
 * límite de página, para que `page_number` sea siempre exacto y la cita
 * `[pág. X]` sea verificable contra el documento original.
 */

export interface PageText {
  /** Número de página 1-based, tal como aparece en el visor del PDF. */
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  totalPages: number;
  pages: PageText[];
}

/** Convierte un archivo en texto por página, sea cual sea su formato. */
export interface DocumentExtractor {
  extractPages(data: Uint8Array): Promise<ParsedDocument>;
}

export interface TextChunk {
  pageNumber: number;
  /** Índice global y consecutivo dentro del documento (0-based). */
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sectionTitle: string | null;
  sectionPath: string[];
  /** Offsets dentro del texto normalizado de la página. */
  charStart: number;
  charEnd: number;
}

export interface ChunkingOptions {
  /** Tamaño máximo aproximado del chunk en tokens. */
  maxTokens: number;
  /** Tokens que se repiten entre chunks consecutivos de la misma sección. */
  overlapTokens: number;
  /** Función de conteo de tokens; por defecto, una heurística ~4 caracteres/token. */
  countTokens?: (text: string) => number;
  /** Detector de encabezados; devuelve el nivel (1 = más general) o null. */
  detectHeading?: (line: string) => number | null;
}

export const DEFAULT_CHUNKING_OPTIONS: Readonly<
  Required<Pick<ChunkingOptions, 'maxTokens' | 'overlapTokens'>>
> = { maxTokens: 400, overlapTokens: 60 };

/** Heurística barata y determinista. Sustituible por un tokenizer real. */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

const NUMBERED_HEADING = /^(\d+(?:\.\d+){0,4})\.?\s+\S.{0,118}$/u;
const KEYWORD_HEADING = /^(cap[ií]tulo|tema|unidad|secci[oó]n|chapter|section)\s+[\w.-]+/iu;

/**
 * Detecta encabezados típicos de apuntes y libros:
 * - Numerados: "2. Célula", "2.3.1 Mitosis" (nivel = cantidad de segmentos).
 * - Palabra clave: "Capítulo 4", "Tema 2: ...".
 * - Líneas cortas en MAYÚSCULAS sin punto final.
 */
export function defaultHeadingDetector(rawLine: string): number | null {
  const line = rawLine.trim();
  if (line.length < 3 || line.length > 120) return null;

  const numbered = NUMBERED_HEADING.exec(line);
  if (numbered?.[1] !== undefined && !line.endsWith('.') && !/[,;]$/u.test(line)) {
    const wordCount = line.split(/\s+/u).length;
    if (wordCount <= 14) return numbered[1].split('.').length;
  }

  if (KEYWORD_HEADING.test(line)) return 1;

  const letters = line.replace(/[^\p{L}]/gu, '');
  if (
    letters.length >= 4 &&
    letters === letters.toLocaleUpperCase() &&
    letters !== letters.toLocaleLowerCase() &&
    !/[.:;,]$/u.test(line) &&
    line.split(/\s+/u).length <= 10
  ) {
    return 1;
  }
  return null;
}

/** Normaliza espacios conservando saltos de línea (necesarios para detectar encabezados). */
export function normalizePageText(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(/\u00ad\n?/gu, '') // guiones blandos
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // palabras partidas al final de línea
    .replace(/[\t\f\v\u00a0]+/gu, ' ')
    .replace(/ {2,}/gu, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

interface Word {
  text: string;
  start: number;
  end: number;
}

interface Segment {
  sectionPath: string[];
  words: Word[];
}

function updateSectionPath(path: string[], heading: string, level: number): string[] {
  const depth = Math.max(1, level);
  return [...path.slice(0, depth - 1), heading];
}

/**
 * Divide una página en segmentos homogéneos por sección. Un encabezado abre un
 * segmento nuevo; el encabezado se incluye en el contenido para que sea buscable.
 */
function segmentPage(
  text: string,
  initialPath: string[],
  detectHeading: (line: string) => number | null,
): { segments: Segment[]; finalPath: string[] } {
  const segments: Segment[] = [];
  let path = initialPath;
  let current: Segment = { sectionPath: path, words: [] };
  let offset = 0;

  for (const line of text.split('\n')) {
    const level = line.length > 0 ? detectHeading(line) : null;
    if (level !== null) {
      if (current.words.length > 0) segments.push(current);
      path = updateSectionPath(path, line.trim(), level);
      current = { sectionPath: path, words: [] };
    }
    const wordRegex = /\S+/gu;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(line)) !== null) {
      current.words.push({
        text: match[0],
        start: offset + match.index,
        end: offset + match.index + match[0].length,
      });
    }
    offset += line.length + 1; // +1 por el '\n'
  }
  if (current.words.length > 0) segments.push(current);
  return { segments, finalPath: path };
}

function assertValidOptions(maxTokens: number, overlapTokens: number): void {
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw new RangeError('maxTokens debe ser un entero positivo');
  }
  if (!Number.isInteger(overlapTokens) || overlapTokens < 0 || overlapTokens >= maxTokens) {
    throw new RangeError('overlapTokens debe ser un entero en [0, maxTokens)');
  }
}

/**
 * Convierte páginas en chunks con solapamiento, conservando `pageNumber`,
 * offsets y la ruta de sección. La sección activa se arrastra entre páginas
 * (un tema que empieza en la pág. 3 sigue vigente en la 4 hasta el siguiente
 * encabezado), pero el texto de cada chunk nunca mezcla dos páginas.
 */
export function chunkPages(pages: readonly PageText[], options: ChunkingOptions): TextChunk[] {
  const { maxTokens, overlapTokens } = options;
  assertValidOptions(maxTokens, overlapTokens);
  const countTokens = options.countTokens ?? estimateTokens;
  const detectHeading = options.detectHeading ?? defaultHeadingDetector;

  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const chunks: TextChunk[] = [];
  let sectionPath: string[] = [];
  let chunkIndex = 0;

  for (const page of sorted) {
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
      throw new RangeError(`pageNumber inválido: ${page.pageNumber}`);
    }
    const text = normalizePageText(page.text);
    if (text.length === 0) continue;

    const { segments, finalPath } = segmentPage(text, sectionPath, detectHeading);
    sectionPath = finalPath;

    for (const segment of segments) {
      const { words } = segment;
      let startIdx = 0;
      while (startIdx < words.length) {
        // Avanza palabra a palabra hasta alcanzar maxTokens (al menos una palabra).
        let endIdx = startIdx + 1;
        while (endIdx < words.length) {
          const candidate = words
            .slice(startIdx, endIdx + 1)
            .map((w) => w.text)
            .join(' ');
          if (countTokens(candidate) > maxTokens) break;
          endIdx += 1;
        }

        const window = words.slice(startIdx, endIdx);
        const first = window[0];
        const last = window[window.length - 1];
        if (first === undefined || last === undefined) break;
        const content = window.map((w) => w.text).join(' ');

        chunks.push({
          pageNumber: page.pageNumber,
          chunkIndex,
          content,
          tokenCount: countTokens(content),
          sectionTitle: segment.sectionPath[segment.sectionPath.length - 1] ?? null,
          sectionPath: [...segment.sectionPath],
          charStart: first.start,
          charEnd: last.end,
        });
        chunkIndex += 1;

        if (endIdx >= words.length) break;

        // Retrocede desde endIdx hasta acumular ~overlapTokens, garantizando progreso.
        let overlapStart = endIdx;
        while (overlapStart > startIdx + 1) {
          const overlapText = words
            .slice(overlapStart - 1, endIdx)
            .map((w) => w.text)
            .join(' ');
          if (countTokens(overlapText) > overlapTokens) break;
          overlapStart -= 1;
        }
        startIdx = overlapTokens === 0 ? endIdx : Math.max(overlapStart, startIdx + 1);
      }
    }
  }
  return chunks;
}
