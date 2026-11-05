/**
 * Árbol de temas derivado de los encabezados que detecta el chunker.
 *
 * Cada chunk trae su `sectionPath` (p. ej. ["1. Biología", "1.1 Mitosis"]).
 * El árbol se arma por prefijos de ruta: cada nodo acumula las páginas donde
 * aparece él o cualquiera de sus descendientes, de modo que `sourcePages`
 * siempre apunta a páginas reales del PDF (verificables, igual que las citas).
 */

export interface TopicSource {
  pageNumber: number;
  sectionPath: readonly string[];
}

export interface TopicNode {
  title: string;
  /** Profundidad 1-based (1 = tema raíz). */
  level: number;
  /** Páginas ordenadas y sin duplicados donde aparece el tema o sus subtemas. */
  sourcePages: number[];
  children: TopicNode[];
}

/** Fila lista para insertar en `topics`, con referencia al padre por índice. */
export interface FlatTopic {
  /** Índice del padre dentro del arreglo plano, o null para raíces. */
  parentIndex: number | null;
  title: string;
  level: number;
  sourcePages: number[];
}

/** Límite defensivo: un PDF patológico no debe generar miles de temas. */
export const MAX_TOPICS = 500;
const MAX_TITLE_LENGTH = 200;

interface MutableNode {
  title: string;
  level: number;
  pages: Set<number>;
  children: Map<string, MutableNode>;
  /** Orden de primera aparición en el documento. */
  firstSeen: number;
}

function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/gu, ' ').trim().slice(0, MAX_TITLE_LENGTH);
}

function freeze(node: MutableNode): TopicNode {
  return {
    title: node.title,
    level: node.level,
    sourcePages: [...node.pages].sort((a, b) => a - b),
    children: [...node.children.values()].sort((a, b) => a.firstSeen - b.firstSeen).map(freeze),
  };
}

export function buildTopicTree(sources: readonly TopicSource[]): TopicNode[] {
  const roots = new Map<string, MutableNode>();
  let order = 0;
  let count = 0;

  const ordered = [...sources].sort((a, b) => a.pageNumber - b.pageNumber);
  for (const source of ordered) {
    if (!Number.isInteger(source.pageNumber) || source.pageNumber < 1) {
      throw new RangeError(`pageNumber inválido: ${source.pageNumber}`);
    }
    let level = roots;
    let depth = 0;
    for (const rawTitle of source.sectionPath) {
      const title = normalizeTitle(rawTitle);
      if (title.length === 0) continue;
      depth += 1;
      let node = level.get(title);
      if (!node) {
        if (count >= MAX_TOPICS) break;
        node = { title, level: depth, pages: new Set(), children: new Map(), firstSeen: order++ };
        level.set(title, node);
        count += 1;
      }
      node.pages.add(source.pageNumber);
      level = node.children;
    }
  }
  return [...roots.values()].sort((a, b) => a.firstSeen - b.firstSeen).map(freeze);
}

/** Recorre en preorden: cada padre aparece antes que sus hijos. */
export function flattenTopicTree(tree: readonly TopicNode[]): FlatTopic[] {
  const out: FlatTopic[] = [];
  const visit = (node: TopicNode, parentIndex: number | null): void => {
    const index = out.length;
    out.push({ parentIndex, title: node.title, level: node.level, sourcePages: node.sourcePages });
    for (const child of node.children) visit(child, index);
  };
  for (const root of tree) visit(root, null);
  return out;
}
