import type { DocTopic } from '@/store/seed';

export interface OutlineSection {
  topic: DocTopic;
  children: DocTopic[];
}

/** Índice de temas del documento en dos niveles: cada tema raíz con sus subtemas (todos). */
export function outlineSections(outline: readonly DocTopic[]): OutlineSection[] {
  const roots = outline.filter((t) => t.depth === 1);
  return roots.map((topic) => ({
    topic,
    children: outline.filter((t) => t.depth > 1 && descendsFrom(outline, t, topic.id)),
  }));
}

function descendsFrom(outline: readonly DocTopic[], topic: DocTopic, rootId: string): boolean {
  const byId = new Map(outline.map((t) => [t.id, t]));
  let current: DocTopic | undefined = topic;
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    if (current.parentId === rootId) return true;
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return false;
}

/** Profundidad de cada tema (1 = raíz) a partir de `parentId`, en el orden recibido. */
export function withDepth(
  topics: readonly { id: string; parentId: string | null; title: string; sourcePages: number[] }[],
): DocTopic[] {
  const parents = new Map(topics.map((t) => [t.id, t.parentId]));
  const depthOf = (id: string): number => {
    let depth = 1;
    let parent = parents.get(id) ?? null;
    const seen = new Set<string>([id]);
    while (parent !== null && !seen.has(parent)) {
      seen.add(parent);
      depth += 1;
      parent = parents.get(parent) ?? null;
    }
    return depth;
  };
  return topics.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    pages: t.sourcePages,
    depth: depthOf(t.id),
  }));
}

/** "1–3, 5, 8–9": páginas ordenadas, con los tramos consecutivos unidos. */
export function formatPageRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const page of sorted.slice(1).concat(Number.NaN)) {
    if (start === undefined || prev === undefined) break;
    if (page === prev + 1) {
      prev = page;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = page;
    prev = page;
  }
  return parts.join(', ');
}
