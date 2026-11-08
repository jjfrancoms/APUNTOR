import { and, asc, desc, eq, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { documentChunks, documents, topics } from '../../db/schema';

/** Largo permitido de la consulta (`GET /v1/search?q=`). */
export const MIN_SEARCH_QUERY = 2;
export const MAX_SEARCH_QUERY = 200;

const MAX_DOCUMENTS = 10;
const MAX_TOPICS = 15;
const MAX_SNIPPETS = 20;
/** Los fragmentos se solapan dentro de la página: se piden de más y se deja uno por página. */
const CHUNK_CANDIDATES = MAX_SNIPPETS * 3;
const MAX_TOKENS = 12;
const SNIPPET_LENGTH = 170;
const SNIPPET_CONTEXT_BEFORE = 50;

/**
 * Tabla de plegado (sin acentos ni mayúsculas): la misma en SQL (`translate`) y en JS, y sin
 * depender de la extensión `unaccent`, que no existe en PGlite y no es inmutable. Las marcas
 * combinantes del final no tienen pareja: `translate` las borra. El índice GIN de
 * `db/migrations/0015_search_fts_index.sql` usa exactamente estas dos cadenas: si cambian, hay que recrearlo.
 */
export const FOLD_FROM = 'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç̀́̂̃̈';
export const FOLD_TO = 'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc';

const FOLD_MAP = new Map(Array.from(FOLD_FROM, (char, i) => [char, FOLD_TO.charAt(i)]));

function foldChar(char: string): string {
  return FOLD_MAP.get(char) ?? char.toLowerCase();
}

/** Texto sin acentos y en minúsculas. */
export function foldText(text: string): string {
  return foldWithOrigin(text).folded;
}

/** Pliega y recuerda de qué posición del original salió cada carácter. */
function foldWithOrigin(text: string): { folded: string; origin: number[] } {
  let folded = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const out = foldChar(text.charAt(i));
    folded += out;
    for (let j = 0; j < out.length; j += 1) origin.push(i);
  }
  origin.push(text.length);
  return { folded, origin };
}

/** Palabras de la consulta, plegadas. Conserva `2.1` entero, como lo guarda `to_tsvector`. */
export function searchTokens(query: string): string[] {
  return (foldText(query).match(/\p{N}+(?:\.\p{N}+)+|[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TOKENS);
}

export interface SnippetHighlight {
  start: number;
  length: number;
}

export interface Snippet {
  snippet: string;
  /** Posiciones de `snippet` que coinciden con la búsqueda. */
  highlights: SnippetHighlight[];
}

interface WordMatch {
  start: number;
  end: number;
  token: string;
}

function findWords(folded: string, tokens: string[]): WordMatch[] {
  const alternatives = tokens.map((t) => t.replace(/\./gu, '\\.')).join('|');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})[\\p{L}\\p{N}]*`, 'gu');
  return [...folded.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    token: tokens.find((t) => match[0].startsWith(t)) ?? match[0],
  }));
}

/** Fragmento corto alrededor de la zona donde aparecen más palabras distintas de la búsqueda. */
export function buildSnippet(content: string, tokens: string[]): Snippet {
  const text = content.replace(/\s+/gu, ' ').trim();
  const { folded, origin } = foldWithOrigin(text);
  const words =
    tokens.length === 0
      ? []
      : findWords(folded, tokens).map((word) => ({
          token: word.token,
          start: origin[word.start] ?? 0,
          end: origin[word.end] ?? text.length,
        }));

  let anchor = words[0];
  let bestScore = 0;
  for (const word of words) {
    const inWindow = words.filter(
      (other) => other.start >= word.start && other.end <= word.start + SNIPPET_LENGTH,
    );
    const score = new Set(inWindow.map((other) => other.token)).size;
    if (score > bestScore) {
      bestScore = score;
      anchor = word;
    }
  }

  let from = 0;
  if (anchor) {
    from = Math.max(0, anchor.start - SNIPPET_CONTEXT_BEFORE);
    // Sin cortar palabras al principio ni al final.
    const space = from > 0 ? text.indexOf(' ', from) : -1;
    if (space !== -1 && space < anchor.start) from = space + 1;
  }
  let to = Math.min(text.length, from + SNIPPET_LENGTH);
  if (to < text.length) {
    const space = text.lastIndexOf(' ', to);
    if (space > (anchor?.end ?? from)) to = space;
  }

  const prefix = from > 0 ? '…' : '';
  return {
    snippet: `${prefix}${text.slice(from, to)}${to < text.length ? '…' : ''}`,
    highlights: words
      .filter((word) => word.start >= from && word.end <= to)
      .map((word) => ({
        start: word.start - from + prefix.length,
        length: word.end - word.start,
      })),
  };
}

export interface DocumentHit {
  id: string;
  title: string;
}

export interface TopicHit {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  pages: number[];
}

export interface SnippetHit extends Snippet {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
}

export interface SearchResults {
  documents: DocumentHit[];
  topics: TopicHit[];
  snippets: SnippetHit[];
}

export interface SearchRepository {
  /** Busca solo en los documentos de `userId`, con los resultados ordenados y limitados. */
  search(userId: string, query: string): Promise<SearchResults>;
}

function foldedColumn(column: AnyColumn): SQL {
  return sql`lower(translate(${column}, ${sql.raw(`'${FOLD_FROM}'`)}, ${sql.raw(`'${FOLD_TO}'`)}))`;
}

function vectorOf(column: AnyColumn): SQL {
  return sql`to_tsvector('simple'::regconfig, ${foldedColumn(column)})`;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/gu, (char) => `\\${char}`);
}

/** Toda consulta filtra por `documents.user_id`, además de RLS. */
export function createSearchRepository(db: Database): SearchRepository {
  return {
    async search(userId, query) {
      const tokens = searchTokens(query);
      if (tokens.length === 0) return { documents: [], topics: [], snippets: [] };
      // Solo letras, números y puntos: no hay comillas que escapar. Por prefijo, para que
      // "limit" encuentre "límites".
      const tsQuery = sql`to_tsquery('simple'::regconfig, ${tokens.map((t) => `'${t}':*`).join(' & ')})`;
      const phrase = escapeLike(foldText(query).replace(/\s+/gu, ' ').trim());
      // En títulos también vale cualquier parte del texto ("gica" encuentra "lógica.pdf").
      const titleMatches = (column: AnyColumn): SQL | undefined =>
        or(
          sql`${foldedColumn(column)} LIKE ${`%${phrase}%`}`,
          sql`${vectorOf(column)} @@ ${tsQuery}`,
        );
      // Primero los títulos que empiezan por la búsqueda, luego los que la contienen.
      const titleTier = (column: AnyColumn): SQL =>
        sql`CASE WHEN ${foldedColumn(column)} LIKE ${`${phrase}%`} THEN 0
          WHEN ${foldedColumn(column)} LIKE ${`%${phrase}%`} THEN 1 ELSE 2 END`;
      const chunkVector = vectorOf(documentChunks.content);

      const [documentRows, topicRows, chunkRows] = await Promise.all([
        db
          .select({ id: documents.id, title: documents.title })
          .from(documents)
          .where(and(eq(documents.userId, userId), titleMatches(documents.title)))
          .orderBy(
            titleTier(documents.title),
            asc(sql`length(${documents.title})`),
            desc(documents.createdAt),
            asc(documents.id),
          )
          .limit(MAX_DOCUMENTS),
        db
          .select({
            id: topics.id,
            documentId: topics.documentId,
            documentTitle: documents.title,
            title: topics.title,
            pages: topics.sourcePages,
          })
          .from(topics)
          .innerJoin(documents, eq(topics.documentId, documents.id))
          .where(
            and(
              eq(documents.userId, userId),
              eq(documents.status, 'completed'),
              titleMatches(topics.title),
            ),
          )
          .orderBy(titleTier(topics.title), asc(sql`length(${topics.title})`), asc(topics.id))
          .limit(MAX_TOPICS),
        db
          .select({
            chunkId: documentChunks.id,
            documentId: documentChunks.documentId,
            documentTitle: documents.title,
            pageNumber: documentChunks.pageNumber,
            content: documentChunks.content,
          })
          .from(documentChunks)
          .innerJoin(documents, eq(documentChunks.documentId, documents.id))
          .where(
            and(
              eq(documents.userId, userId),
              eq(documents.status, 'completed'),
              sql`${chunkVector} @@ ${tsQuery}`,
            ),
          )
          .orderBy(
            desc(sql`ts_rank(${chunkVector}, ${tsQuery})`),
            asc(documentChunks.documentId),
            asc(documentChunks.pageNumber),
            asc(documentChunks.chunkIndex),
          )
          .limit(CHUNK_CANDIDATES),
      ]);

      const seenPages = new Set<string>();
      const snippets: SnippetHit[] = [];
      for (const { content, ...chunk } of chunkRows) {
        const page = `${chunk.documentId}:${chunk.pageNumber}`;
        if (seenPages.has(page) || snippets.length >= MAX_SNIPPETS) continue;
        seenPages.add(page);
        snippets.push({ ...chunk, ...buildSnippet(content, tokens) });
      }
      return { documents: documentRows, topics: topicRows, snippets };
    },
  };
}
