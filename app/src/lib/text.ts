export interface TextPart {
  text: string;
  hit: boolean;
}

/** Divide el texto marcando los tramos que indica el servidor (ignora los que no encajan). */
export function highlightParts(
  text: string,
  highlights: readonly { start: number; length: number }[],
): TextPart[] {
  const out: TextPart[] = [];
  let from = 0;
  for (const { start, length } of [...highlights].sort((a, b) => a.start - b.start)) {
    if (start < from || length <= 0 || start + length > text.length) continue;
    if (start > from) out.push({ text: text.slice(from, start), hit: false });
    out.push({ text: text.slice(start, start + length), hit: true });
    from = start + length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
}

/** Divide el texto marcando las coincidencias (sin distinguir mayúsculas). */
export function splitMatch(text: string, query: string): TextPart[] {
  if (query.length === 0) return [{ text, hit: false }];
  const lower = text.toLocaleLowerCase('es');
  const q = query.toLocaleLowerCase('es');
  const out: TextPart[] = [];
  let from = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, from)) {
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + q.length), hit: true });
    from = i + q.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
}
