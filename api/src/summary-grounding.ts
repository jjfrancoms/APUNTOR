import { compact, contentOverlap } from './rag/citations';
import type { ParsedBlock } from './summary-markdown';

/**
 * Comprobación ligera de un resumen contra las páginas que cita. No es `validateAnswer()`: un
 * resumen parafrasea y no trae citas literales, así que aquí un fallo no descarta nada. El
 * bloque se conserva, sin página (no se afirma una fuente que no se pudo comprobar) y marcado.
 */

/** Más bajo que `MIN_CLAIM_OVERLAP` del chat: resumir cambia más las palabras que citar. */
export const MIN_SUMMARY_OVERLAP = 0.4;

export type GroundedBlock = ParsedBlock & { unverified?: boolean };

function sourcesFor(pages: readonly number[], pageTexts: ReadonlyMap<number, string>): string[] {
  return pages.flatMap((page) => {
    const text = pageTexts.get(page);
    return text === undefined ? [] : [text];
  });
}

function isSupported(text: string, sources: readonly string[]): boolean {
  if (sources.length === 0) return false;
  const overlap = contentOverlap(text, sources);
  return overlap === null || overlap >= MIN_SUMMARY_OVERLAP;
}

/**
 * Párrafos y puntos de lista deben compartir suficientes palabras con sus páginas, y las
 * fórmulas aparecer en ellas sin contar espacios. Una lista se separa en tramos para que un
 * punto dudoso no le quite la página a los demás. Títulos, tablas y figuras no se tocan.
 */
export function verifySummaryBlocks(
  blocks: readonly ParsedBlock[],
  pageTexts: ReadonlyMap<number, string>,
): GroundedBlock[] {
  return blocks.flatMap((block): GroundedBlock[] => {
    if (block.type === 'paragraph') {
      const ok = isSupported(block.text, sourcesFor(block.pages, pageTexts));
      return [ok ? block : { ...block, pages: [], unverified: true }];
    }
    if (block.type === 'formula') {
      const wanted = compact(block.text);
      const ok = sourcesFor(block.pages, pageTexts).some((s) => compact(s).includes(wanted));
      return [ok ? block : { ...block, pages: [], unverified: true }];
    }
    if (block.type === 'list') {
      const sources = sourcesFor(block.pages, pageTexts);
      const runs: { ok: boolean; items: string[] }[] = [];
      for (const item of block.items) {
        const ok = isSupported(item, sources);
        const last = runs[runs.length - 1];
        if (last?.ok === ok) last.items.push(item);
        else runs.push({ ok, items: [item] });
      }
      return runs.map((run) =>
        run.ok
          ? { ...block, items: run.items }
          : { ...block, items: run.items, pages: [], unverified: true },
      );
    }
    return [block];
  });
}
