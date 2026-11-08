/**
 * Convierte el Markdown del resumen en bloques con estructura. El modelo escribe Markdown (lo
 * hace con mucha más soltura que JSON largo) y aquí se valida y se lleva a bloques que la app
 * dibuja: títulos, párrafos, listas, tablas, fórmulas (líneas que empiezan con ">>") y figuras
 * (`![leyenda](figura:PÁGINA:ymin,xmin,ymax,xmax)`, caja en escala 0–1000).
 */

export type ParsedBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string; pages: number[] }
  | { type: 'list'; items: string[]; pages: number[] }
  | { type: 'table'; header: string[]; rows: string[][]; pages: number[] }
  | { type: 'formula'; text: string; pages: number[] }
  | { type: 'figure'; page: number; box: number[]; caption: string };

const PAGE_TAG = /\s*\((?:p[áa]gs?|pp?|pages?)\.?\s*([\d\s,–-]+)\)\s*/giu;
const FIGURE = /^!\[([^\]]*)\]\(\s*figura\s*:\s*(\d+)\s*:\s*([\d.\s,]+)\)\s*$/iu;
const LIST_ITEM = /^(?:[-*•]|\d{1,3}[.)])\s+(.*)$/u;
const MAX_CELL = 200;

/** "2, 3–5" → [2, 3, 4, 5] (como mucho 20 páginas). */
export function parsePageList(raw: string): number[] {
  const pages = new Set<number>();
  for (const part of raw.split(',')) {
    const [a, b] = part.split(/[–-]/u).map((x) => Number(x.trim()));
    if (a === undefined || !Number.isInteger(a) || a < 1) continue;
    const end = b !== undefined && Number.isInteger(b) && b >= a ? Math.min(b, a + 20) : a;
    for (let p = a; p <= end; p += 1) pages.add(p);
  }
  return [...pages].sort((x, y) => x - y).slice(0, 20);
}

/** Quita las marcas de página "(pág. 2)" del texto y las devuelve aparte. */
function takePages(text: string): { text: string; pages: number[] } {
  const pages: number[] = [];
  const clean = text.replace(PAGE_TAG, (_m, list: string) => {
    pages.push(...parsePageList(list));
    return ' ';
  });
  return { text: plain(clean), pages: [...new Set(pages)].sort((a, b) => a - b) };
}

/** Sin marcas de Markdown en línea (negritas, cursivas, código). */
function plain(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/__([^_]+)__/gu, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/gu, '$1$2')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((c) => plain(c).slice(0, MAX_CELL));

const isSeparator = (line: string): boolean =>
  /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/u.test(line.trim());

export function parseSummaryMarkdown(markdown: string): ParsedBlock[] {
  const lines = markdown.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: ParsedBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  const lastWithPages = (): Extract<ParsedBlock, { pages: number[] }> | undefined => {
    const last = blocks[blocks.length - 1];
    return last && 'pages' in last ? last : undefined;
  };
  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const { text, pages } = takePages(paragraph.join(' '));
    if (text.length > 0) blocks.push({ type: 'paragraph', text, pages });
    paragraph = [];
  };
  const flushList = (): void => {
    if (list.length === 0) return;
    const pages = new Set<number>();
    const items = list.flatMap((raw) => {
      const item = takePages(raw);
      item.pages.forEach((p) => pages.add(p));
      return item.text.length > 0 ? [item.text] : [];
    });
    if (items.length > 0) {
      blocks.push({
        type: 'list',
        items: items.slice(0, 40),
        pages: [...pages].sort((a, b) => a - b),
      });
    }
    list = [];
  };
  const flushTable = (): void => {
    if (table.length === 0) return;
    const rows = table.filter((l) => !isSeparator(l)).map(cells);
    const [header, ...body] = rows;
    if (header && header.length > 0 && body.length > 0) {
      const width = Math.min(12, header.length);
      blocks.push({
        type: 'table',
        header: header.slice(0, width),
        rows: body
          .slice(0, 60)
          .map((r) => [...r, ...Array<string>(width).fill('')].slice(0, width)),
        pages: [],
      });
    }
    table = [];
  };
  const flushAll = (): void => {
    flushParagraph();
    flushList();
    flushTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushAll();
      continue;
    }
    if (line.startsWith('|')) {
      flushParagraph();
      flushList();
      table.push(line);
      continue;
    }
    flushTable();

    // Una línea que solo trae páginas ("(pág. 3)") es de la tabla, lista o párrafo anterior.
    const onlyPages = takePages(line);
    if (onlyPages.text.length === 0 && onlyPages.pages.length > 0) {
      flushParagraph();
      flushList();
      const target = lastWithPages();
      if (target)
        target.pages = [...new Set([...target.pages, ...onlyPages.pages])].sort((a, b) => a - b);
      continue;
    }

    const heading = /^#{1,6}\s+(.+)$/u.exec(line);
    if (heading?.[1] !== undefined) {
      flushAll();
      const text = takePages(heading[1]).text;
      if (text.length > 0) blocks.push({ type: 'heading', text: text.slice(0, 200) });
      continue;
    }
    const figure = FIGURE.exec(line.replace(PAGE_TAG, ' ').trim());
    if (figure) {
      flushAll();
      const box = (figure[3] ?? '').split(',').map((n) => Number(n.trim()));
      if (box.length === 4 && box.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) {
        blocks.push({
          type: 'figure',
          page: Number(figure[2]),
          box,
          caption: plain(figure[1] ?? '').slice(0, 300),
        });
      }
      continue;
    }
    if (line.startsWith('>>')) {
      flushAll();
      const { text, pages } = takePages(line.slice(2));
      if (text.length > 0) blocks.push({ type: 'formula', text: text.slice(0, 500), pages });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item?.[1] !== undefined) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushAll();
  return blocks.slice(0, 80);
}
