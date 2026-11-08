import type { DocTopic } from '@/store/seed';

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

export interface OutlineNode {
  topic: DocTopic;
  children: OutlineNode[];
}

/** Árbol de temas (cualquier profundidad), en el orden del documento. */
export function outlineTree(outline: readonly DocTopic[]): OutlineNode[] {
  const nodes = new Map(outline.map((t) => [t.id, { topic: t, children: [] as OutlineNode[] }]));
  const roots: OutlineNode[] = [];
  for (const topic of outline) {
    const node = nodes.get(topic.id);
    if (!node) continue;
    const parent = topic.parentId === null ? undefined : nodes.get(topic.parentId);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Abre o cierra un tema; al cerrarlo se cierran también sus subtemas abiertos. */
export function toggleExpanded(expanded: ReadonlySet<string>, node: OutlineNode): Set<string> {
  const next = new Set(expanded);
  if (!next.delete(node.topic.id)) {
    next.add(node.topic.id);
    return next;
  }
  const close = (n: OutlineNode): void => {
    next.delete(n.topic.id);
    n.children.forEach(close);
  };
  close(node);
  return next;
}
