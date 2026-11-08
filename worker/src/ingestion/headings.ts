/**
 * Detección de títulos por formato visual.
 *
 * La mayoría de los apuntes no usan estilos de "Título 1": marcan los títulos con letra más
 * grande, negrita o color. Se toma como referencia la letra "normal" del propio documento (la
 * que cubre más texto) y es título una línea corta que se sale de esa norma. Los niveles salen
 * del tamaño (más grande = más general) y, dentro de un mismo tamaño, de la numeración
 * ("Tema 1" > "1.1"). Sin IA: determinista y gratis.
 */

/** Una línea (o párrafo) con el formato con que se ve en el documento. */
export interface StyledLine {
  text: string;
  /** Tamaño de letra en puntos (si el formato lo informa). */
  size?: number;
  bold?: boolean;
  /** Color en hex sin '#', en minúsculas (si no es el automático). */
  color?: string;
  /** Nivel de esquema explícito (estilos de título de Word, título de diapositiva): 1 = general. */
  outlineLevel?: number;
}

export interface StyledPage {
  pageNumber: number;
  lines: readonly StyledLine[];
}

/** Título detectado en una página: `title` es el texto completo (puede unir varias líneas). */
export interface DetectedHeading {
  level: number;
  title: string;
  /** La línea es la continuación de un título que empezó en la línea anterior. */
  continuation: boolean;
}

/** Títulos por página, indexados por `headingKey(línea)`. */
export type HeadingMap = Map<number, Map<string, DetectedHeading>>;

const MAX_TITLE_CHARS = 120;
const MAX_TITLE_WORDS = 14;
const MAX_LEVEL = 5;
/** Un estilo que cubre más de esta fracción del texto no es de títulos, es de cuerpo. */
const MAX_STYLE_SHARE = 0.25;

/** Clave para comparar líneas sin depender de espacios ni mayúsculas. */
export function headingKey(line: string): string {
  return line.replace(/\s+/gu, '').toLocaleLowerCase();
}

const MATH_OR_LOGIC = /[→←↔⇒⇐⇔∧∨¬∀∃≡≠≤≥=+*^<>|∴∵∈∉⊂⊃⊆⊇∪∩∑∏√∫≈±×÷−]/u;
const NUMBERING = /^(\d{1,3}(?:\.\d{1,3}){0,4})\.?\s+/u;
const KEYWORD = /^(cap[ií]tulo|tema|unidad|secci[oó]n|parte|m[oó]dulo|chapter|section|unit)\b/iu;

/**
 * ¿Puede ser el texto de un título? Descarta filas de tablas ("0 1 1", "V F F"), fórmulas,
 * números de página y líneas sin palabras reales.
 */
export function looksLikeTitle(rawLine: string): boolean {
  const line = rawLine.trim();
  if (line.length < 2 || line.length > MAX_TITLE_CHARS) return false;
  if (MATH_OR_LOGIC.test(line)) return false;
  const tokens = line.split(/\s+/u);
  if (tokens.length > MAX_TITLE_WORDS) return false;
  // Al menos una palabra de 3+ letras con vocal (descarta "VVFF", "0 0 1", "n n").
  const hasWord = tokens.some((t) => {
    const letters = t.replace(/[^\p{L}]/gu, '');
    return letters.length >= 3 && /[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/u.test(letters);
  });
  if (!hasWord) return false;
  // Filas de tabla: mayoría de "palabras" de un solo carácter.
  const single = tokens.filter((t) => t.length === 1).length;
  if (tokens.length >= 3 && single / tokens.length >= 0.5) return false;
  return true;
}

/** Profundidad de la numeración: "2" → 1, "2.3.1" → 3; palabra clave → 1; sin número → 0. */
export function numberingDepth(line: string): number {
  const numbered = NUMBERING.exec(line.trim());
  if (numbered?.[1] !== undefined) return numbered[1].split('.').length;
  return KEYWORD.test(line.trim()) ? 1 : 0;
}

export function isNumberedOrKeyword(line: string): boolean {
  return numberingDepth(line) > 0;
}

/**
 * Líneas que se repiten en muchas páginas (encabezado o pie con el nombre del curso): nunca
 * son títulos. Devuelve sus claves.
 */
export function repeatedLineKeys(pages: readonly { lines: readonly string[] }[]): Set<string> {
  const pagesWith = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.lines) {
      const key = headingKey(line);
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      pagesWith.set(key, (pagesWith.get(key) ?? 0) + 1);
    }
  }
  const minPages = Math.max(3, Math.ceil(pages.length * 0.3));
  return new Set([...pagesWith].filter(([, n]) => n >= minPages).map(([key]) => key));
}

const roundSize = (size: number): number => Math.round(size * 2) / 2;

function styleKey(line: StyledLine): string {
  return `${line.size === undefined ? '-' : roundSize(line.size)}|${line.bold ? 'b' : ''}|${line.color ?? ''}`;
}

/** El valor que más texto cubre (la letra "normal" del documento). */
function dominant<T>(lines: readonly StyledLine[], pick: (l: StyledLine) => T): T | undefined {
  const weight = new Map<T, number>();
  for (const line of lines) {
    const value = pick(line);
    weight.set(value, (weight.get(value) ?? 0) + line.text.trim().length);
  }
  let best: T | undefined;
  let bestWeight = -1;
  for (const [value, w] of weight) {
    if (w > bestWeight) {
      best = value;
      bestWeight = w;
    }
  }
  return best;
}

interface Candidate {
  pageNumber: number;
  index: number;
  line: StyledLine;
  style: string;
  /** Tamaño redondeado (o -1 si no se conoce). */
  size: number;
}

/**
 * Detecta títulos por formato en todo el documento. Devuelve `null` si el documento no trae
 * formato útil (todo con la misma letra): entonces se usa la detección por texto.
 */
export function detectStyledHeadings(pages: readonly StyledPage[]): HeadingMap | null {
  const all = pages.flatMap((p) => p.lines).filter((l) => l.text.trim().length > 0);
  if (all.length === 0) return null;

  const bodySize = dominant(all, (l) => (l.size === undefined ? undefined : roundSize(l.size)));
  const bodyBold = dominant(all, (l) => l.bold === true) ?? false;
  const bodyColor = dominant(all, (l) => l.color);
  const totalChars = all.reduce((n, l) => n + l.text.trim().length, 0);
  const repeated = repeatedLineKeys(pages.map((p) => ({ lines: p.lines.map((l) => l.text) })));

  const stands = (line: StyledLine): boolean => {
    const size = line.size === undefined ? undefined : roundSize(line.size);
    const words = line.text.trim().split(/\s+/u).length;
    if (size !== undefined && bodySize !== undefined) {
      if (size >= bodySize * 1.1 && size - bodySize >= 1) return true;
      if (size < bodySize - 0.5) return false; // más pequeña: notas, pies, encabezados
    }
    if (line.bold === true && !bodyBold) return words <= 12;
    if (line.color !== undefined && line.color !== bodyColor) return words <= 10;
    return false;
  };

  const candidates: Candidate[] = [];
  const explicit: { pageNumber: number; index: number; line: StyledLine }[] = [];
  for (const page of pages) {
    page.lines.forEach((line, index) => {
      const text = line.text.trim();
      if (text.length === 0 || repeated.has(headingKey(text))) return;
      if (!looksLikeTitle(text)) return;
      if (line.outlineLevel !== undefined) {
        explicit.push({ pageNumber: page.pageNumber, index, line });
        return;
      }
      if (!stands(line)) return;
      const size = line.size === undefined ? -1 : roundSize(line.size);
      candidates.push({ pageNumber: page.pageNumber, index, line, style: styleKey(line), size });
    });
  }

  // Un estilo que cubre mucho texto es de cuerpo (p. ej. todo un párrafo en negrita).
  const styleChars = new Map<string, number>();
  for (const c of candidates) {
    styleChars.set(c.style, (styleChars.get(c.style) ?? 0) + c.line.text.trim().length);
  }
  const kept = candidates.filter(
    (c) => (styleChars.get(c.style) ?? 0) / totalChars <= MAX_STYLE_SHARE,
  );
  if (kept.length === 0 && explicit.length === 0) return null;

  // Rango por estilo: más grande primero; a igual tamaño, negrita y luego color.
  const styles = [...new Set(kept.map((c) => c.style))];
  const rankOf = new Map<string, number>();
  const sample = new Map(kept.map((c) => [c.style, c]));
  styles
    .sort((a, b) => {
      const ca = sample.get(a);
      const cb = sample.get(b);
      if (!ca || !cb) return 0;
      if (cb.size !== ca.size) return cb.size - ca.size;
      if ((cb.line.bold === true) !== (ca.line.bold === true)) return cb.line.bold ? 1 : -1;
      return (cb.line.color ? 1 : 0) - (ca.line.color ? 1 : 0);
    })
    .forEach((style, i) => rankOf.set(style, i + 1));
  // Tamaños iguales con distinto color o negrita comparten nivel si solo cambia el adorno.
  const sizeRank = new Map<number, number>();
  for (const size of [...new Set(kept.map((c) => c.size))].sort((a, b) => b - a)) {
    sizeRank.set(size, sizeRank.size + 1);
  }
  const knownSizes = kept.some((c) => c.size !== -1);
  const baseLevel = (c: Candidate): number =>
    knownSizes ? (sizeRank.get(c.size) ?? 1) : (rankOf.get(c.style) ?? 1);

  // Dentro de un mismo nivel base, la numeración más profunda baja de nivel ("1.1" bajo "Tema 1").
  const minDepth = new Map<number, number>();
  for (const c of kept) {
    const base = baseLevel(c);
    const depth = Math.max(1, numberingDepth(c.line.text));
    minDepth.set(base, Math.min(minDepth.get(base) ?? depth, depth));
  }
  const levelOf = (c: Candidate): number => {
    const base = baseLevel(c);
    const depth = Math.max(1, numberingDepth(c.line.text));
    return base + depth - (minDepth.get(base) ?? depth);
  };
  // Los títulos de esquema explícitos (estilos de Word) mandan sobre los visuales.
  const explicitOffset =
    explicit.length > 0 ? Math.max(...explicit.map((e) => e.line.outlineLevel ?? 1)) : 0;

  const map: HeadingMap = new Map();
  const add = (pageNumber: number, line: string, heading: DetectedHeading): void => {
    const page = map.get(pageNumber) ?? new Map<string, DetectedHeading>();
    const key = headingKey(line);
    if (!page.has(key)) page.set(key, heading);
    map.set(pageNumber, page);
  };
  for (const e of explicit) {
    add(e.pageNumber, e.line.text, {
      level: Math.min(MAX_LEVEL, e.line.outlineLevel ?? 1),
      title: e.line.text.trim(),
      continuation: false,
    });
  }

  // Une títulos partidos en dos líneas seguidas con el mismo estilo ("Capítulo I" / "Lógica…").
  const byPosition = [...kept].sort((a, b) => a.pageNumber - b.pageNumber || a.index - b.index);
  for (let i = 0; i < byPosition.length; i += 1) {
    const first = byPosition[i];
    if (!first) continue;
    const parts = [first];
    let next = byPosition[i + 1];
    while (
      next &&
      next.pageNumber === first.pageNumber &&
      next.index === (parts[parts.length - 1]?.index ?? -2) + 1 &&
      next.style === first.style &&
      !isNumberedOrKeyword(next.line.text) &&
      parts.length < 3
    ) {
      parts.push(next);
      i += 1;
      next = byPosition[i + 1];
    }
    const title = parts.map((p) => p.line.text.trim()).join(' ');
    const level = Math.min(MAX_LEVEL, levelOf(first) + explicitOffset);
    parts.forEach((part, n) => {
      add(part.pageNumber, part.line.text, { level, title, continuation: n > 0 });
    });
  }
  return map;
}
