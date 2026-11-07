const STOPWORDS = new Set(
  'a al algo como con cual cuando de del el en es esa ese eso esta este la las lo los me mi no o para por que qué se si su sus te tu un una uno y ya the of and is what how'.split(
    ' ',
  ),
);

/** Minúsculas y sin tildes: "Límite" → "limite". */
export function normalize(text: string): string {
  return text.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/gu, '');
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9ñ]+/u)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t));
}

/** Proporción de términos de la consulta presentes en el texto (0–1). */
export function overlapScore(query: string, text: string): number {
  const q = [...new Set(tokenize(query))];
  if (q.length === 0) return 0;
  const t = new Set(tokenize(text));
  return q.filter((w) => t.has(w)).length / q.length;
}
