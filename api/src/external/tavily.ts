import { z } from 'zod';

export interface ExternalResult {
  title: string;
  url: string;
  snippet: string;
}

export type ExternalSearch = (question: string) => Promise<ExternalResult[]>;

const responseSchema = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string(), content: z.string() })),
});

const MAX_RESULTS = 3;
const TIMEOUT_MS = 10_000;

/**
 * Búsqueda en internet. Sus resultados nunca entran al prompt ni se mezclan con los
 * apuntes: viajan aparte para que la app los muestre en violeta y con su fuente.
 */
export function createTavilySearch(apiKey: string): ExternalSearch {
  return async (question) => {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, max_results: MAX_RESULTS }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Tavily respondió HTTP ${response.status}`);
    const parsed = responseSchema.parse(await response.json());
    return parsed.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content }));
  };
}
