/** Ayudas puras para mostrar el texto de un resumen (sin tocar lo que se guarda). */

/** Quita los espacios antes de `. , ; : ) ? !` y después de `( ¿ ¡` (artefacto del OCR). */
export function tidyText(text: string): string {
  return text.replace(/[ \t ]+([.,;:)?!])/gu, '$1').replace(/([(¿¡])[ \t ]+/gu, '$1');
}

/** Máximo de palabras del término de una definición («Término: explicación»). */
const MAX_TERM_WORDS = 6;

/**
 * Separa «Término: explicación» cuando lo anterior a los primeros dos puntos es corto y no es una
 * oración. Devuelve `null` si el texto no tiene esa forma.
 */
export function splitDefinition(text: string): { term: string; rest: string } | null {
  const at = text.indexOf(':');
  if (at <= 0) return null;
  const term = text.slice(0, at).trim();
  const rest = text.slice(at + 1).trim();
  if (term.length === 0 || rest.length === 0) return null;
  if (term.split(/\s+/u).length > MAX_TERM_WORDS) return null;
  if (/[.?!;]/u.test(term)) return null;
  return { term, rest };
}

/** Forma comparable de un título: sin numeración inicial («1.», «Tema 1.»), tildes ni mayúsculas. */
export function titleKey(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^\s*(?:tema|capitulo|unidad|seccion)?\s*\d+(?:\.\d+)*\s*[.):-]?\s*/u, '')
    .replace(/[\s.:;,]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** `true` si dos títulos son el mismo salvo por numeración, mayúsculas o espacios. */
export function sameTitle(a: string, b: string): boolean {
  const left = titleKey(a);
  return left.length > 0 && left === titleKey(b);
}
