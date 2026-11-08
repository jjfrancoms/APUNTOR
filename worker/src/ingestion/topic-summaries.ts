import { isTransientAiError } from '../../../api/src/llm/retry';
import { manifestKey, parsePageManifest, type PageManifest } from '../../../api/src/page-manifest';
import type { FileStorage } from '../../../api/src/storage/file-storage';
import {
  buildTopicContent,
  withPageStructure,
  type ChunkRow,
  type TopicRow,
} from '../../../api/src/topic-content';
import type { TopicSummarizer } from '../../../api/src/topic-summary';

/**
 * Resúmenes de tema generados de antemano en el worker, tras completar la ingesta: cuando el
 * estudiante abre un tema, el resumen ya está guardado en R2 y no espera al modelo alto. Usa el
 * mismo `createTopicSummarizer` que la API (misma clave de caché), así que un resumen que falte se
 * sigue generando al pedirlo. Nunca cambia el estado del documento.
 */

/** Temas resumidos como máximo por documento (el resto se genera al pedirlo). */
export const MAX_PREGENERATED_SUMMARIES = 40;
/**
 * Tiempo máximo dedicado a los resúmenes dentro del trabajo de la cola: debe quedar por debajo
 * de `expireInSeconds` (30 min, `api/src/queue.ts`) para que pg-boss no lo dé por vencido.
 */
export const SUMMARY_TIME_BUDGET_MS = 20 * 60_000;

export interface SummaryPregenerationInput {
  documentId: string;
  filePath: string;
  topics: readonly TopicRow[];
  chunks: readonly ChunkRow[];
}

export interface SummaryPregenerationResult {
  generated: number;
  failed: number;
  skipped: number;
}

export interface SummaryPregenerator {
  generate(input: SummaryPregenerationInput): Promise<SummaryPregenerationResult>;
}

const firstPage = (topic: TopicRow): number =>
  topic.sourcePages.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...topic.sourcePages);

/**
 * Temas raíz y temas hoja (sin subtemas), en orden de aparición en el documento, hasta `max`.
 * Los intermedios se generan solo si el estudiante los abre.
 */
export function selectSummaryTopics(
  topics: readonly TopicRow[],
  max = MAX_PREGENERATED_SUMMARIES,
): TopicRow[] {
  const parents = new Set(topics.flatMap((t) => (t.parentId === null ? [] : [t.parentId])));
  return topics
    .map((topic, index) => ({ topic, index }))
    .filter(({ topic }) => topic.parentId === null || !parents.has(topic.id))
    .sort((a, b) => firstPage(a.topic) - firstPage(b.topic) || a.index - b.index)
    .slice(0, max)
    .map(({ topic }) => topic);
}

async function readManifest(storage: FileStorage, filePath: string): Promise<PageManifest | null> {
  try {
    return parsePageManifest(await storage.download(manifestKey(filePath)));
  } catch {
    return null;
  }
}

export function createSummaryPregenerator(deps: {
  summarizer: Pick<TopicSummarizer, 'get'>;
  storage: FileStorage;
  maxTopics?: number;
  timeBudgetMs?: number;
  now?: () => number;
}): SummaryPregenerator {
  const now = deps.now ?? Date.now;
  const budget = deps.timeBudgetMs ?? SUMMARY_TIME_BUDGET_MS;
  return {
    async generate(input) {
      const selected = selectSummaryTopics(input.topics, deps.maxTopics);
      const result: SummaryPregenerationResult = { generated: 0, failed: 0, skipped: 0 };
      if (selected.length === 0) return result;
      const manifest = await readManifest(deps.storage, input.filePath);
      const pageTexts = new Map((manifest?.pages ?? []).map((p) => [p.pageNumber, p.text]));
      const deadline = now() + budget;

      // Uno por uno: el plan gratis limita las peticiones por minuto (los reintentos los hace
      // el cliente de la IA del worker, con WORKER_AI_RETRY).
      for (const [index, topic] of selected.entries()) {
        if (now() >= deadline) {
          result.skipped += selected.length - index;
          break;
        }
        const content = buildTopicContent(input.topics, input.chunks, topic.id);
        if (!content || content.blocks.length === 0) {
          result.skipped += 1;
          continue;
        }
        try {
          await deps.summarizer.get({
            filePath: input.filePath,
            topic: content.topic,
            path: content.path,
            blocks: withPageStructure(content.blocks, pageTexts),
            manifest,
          });
          result.generated += 1;
        } catch (error) {
          result.failed += 1;
          // Sin contenido en el log: solo el documento y el tipo de fallo.
          if (isTransientAiError(error)) {
            console.warn(`[resúmenes] ${input.documentId}: límite de la IA, se dejan para después`);
            result.skipped += selected.length - index - 1;
            break;
          }
          console.warn(`[resúmenes] ${input.documentId}: no se pudo resumir un tema`);
        }
      }
      return result;
    },
  };
}
