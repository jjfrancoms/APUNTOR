/** Divide el texto marcando las coincidencias (sin distinguir mayúsculas). */
export function splitMatch(text: string, query: string): { text: string; hit: boolean }[] {
  if (query.length === 0) return [{ text, hit: false }];
  const lower = text.toLocaleLowerCase('es');
  const q = query.toLocaleLowerCase('es');
  const out: { text: string; hit: boolean }[] = [];
  let from = 0;
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, from)) {
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + q.length), hit: true });
    from = i + q.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
}
