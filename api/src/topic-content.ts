/**
 * Contenido de un tema: el texto del documento que cae bajo ese título (y sus subtítulos),
 * página por página, para leerlo antes de preguntarle a la IA. Sale de los fragmentos ya
 * guardados: no llama al LLM y la página de cada bloque es la del fragmento.
 */

export interface TopicRow {
  id: string;
  parentId: string | null;
  title: string;
  sourcePages: number[];
}

export interface ChunkRow {
  pageNumber: number;
  chunkIndex: number;
  content: string;
  sectionPath: readonly string[];
  /** Offsets del fragmento en el texto normalizado de la página. */
  charStart: number;
  charEnd: number;
}

export interface TopicBlock {
  pageNumber: number;
  /** Ruta del título bajo el que está el texto (para mostrar subtítulos). */
  sectionPath: string[];
  text: string;
  /** Tramo del texto de la página que cubre el bloque (para recuperar su estructura). */
  charStart: number;
  charEnd: number;
}

export interface TopicContent {
  topic: TopicRow;
  /** Títulos desde la raíz hasta el tema. */
  path: string[];
  blocks: TopicBlock[];
  /** El texto se cortó al llegar al máximo. */
  truncated: boolean;
}

/** Tope de texto por respuesta: un tema enorme no debe mandar el libro entero. */
export const MAX_TOPIC_CHARS = 30_000;
/** El chunker repite hasta ~60 tokens; se busca el solapamiento en un margen holgado. */
const MAX_OVERLAP_WORDS = 120;

/** Igual que el árbol de temas: espacios colapsados y como mucho 200 caracteres. */
const normalizeTitle = (raw: string): string => raw.replace(/\s+/gu, ' ').trim().slice(0, 200);

export function topicPath(topics: readonly TopicRow[], topicId: string): string[] | null {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(topicId);
  if (!current) return null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(normalizeTitle(current.title));
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return path;
}

function startsWithPath(sectionPath: readonly string[], prefix: readonly string[]): boolean {
  if (sectionPath.length < prefix.length) return false;
  return prefix.every((title, i) => normalizeTitle(sectionPath[i] ?? '') === title);
}

/** Une dos fragmentos seguidos quitando las palabras que el segundo repite del primero. */
export function joinWithoutOverlap(previous: string, next: string): string {
  const a = previous.split(' ');
  const b = next.split(' ');
  const max = Math.min(MAX_OVERLAP_WORDS, a.length - 1, b.length);
  for (let k = max; k > 0; k -= 1) {
    let same = true;
    for (let i = 0; i < k; i += 1) {
      if (a[a.length - k + i] !== b[i]) {
        same = false;
        break;
      }
    }
    if (same) return [...a, ...b.slice(k)].join(' ');
  }
  return `${previous} ${next}`;
}

export function buildTopicContent(
  topics: readonly TopicRow[],
  chunks: readonly ChunkRow[],
  topicId: string,
): TopicContent | null {
  const topic = topics.find((t) => t.id === topicId);
  const path = topicPath(topics, topicId);
  if (!topic || !path) return null;

  const blocks: TopicBlock[] = [];
  let total = 0;
  let truncated = false;
  const ordered = [...chunks].sort((x, y) => x.chunkIndex - y.chunkIndex);
  let previousIndex = -2;
  for (const chunk of ordered) {
    if (!startsWithPath(chunk.sectionPath, path)) continue;
    const last = blocks[blocks.length - 1];
    const samePlace =
      last !== undefined &&
      last.pageNumber === chunk.pageNumber &&
      chunk.chunkIndex === previousIndex + 1 &&
      last.sectionPath.join('\u0000') === chunk.sectionPath.join('\u0000');
    if (samePlace) {
      const before = last.text.length;
      last.text = joinWithoutOverlap(last.text, chunk.content);
      last.charStart = Math.min(last.charStart, chunk.charStart);
      last.charEnd = Math.max(last.charEnd, chunk.charEnd);
      total += last.text.length - before;
    } else {
      blocks.push({
        pageNumber: chunk.pageNumber,
        sectionPath: [...chunk.sectionPath],
        text: chunk.content,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd,
      });
      total += chunk.content.length;
    }
    previousIndex = chunk.chunkIndex;
    if (total >= MAX_TOPIC_CHARS) {
      truncated = true;
      break;
    }
  }
  return { topic, path, blocks, truncated };
}

/**
 * Devuelve a cada bloque los saltos de línea, listas y tablas del documento: el texto sale del
 * tramo de la página que cubren sus fragmentos (no de los fragmentos, que van en una línea).
 */
export function withPageStructure(
  blocks: readonly TopicBlock[],
  pageTexts: ReadonlyMap<number, string>,
): TopicBlock[] {
  return blocks.map((block) => {
    const page = pageTexts.get(block.pageNumber);
    if (page === undefined || block.charEnd > page.length || block.charStart >= block.charEnd) {
      return block;
    }
    const text = page.slice(block.charStart, block.charEnd).trim();
    return text.length > 0 ? { ...block, text } : block;
  });
}
