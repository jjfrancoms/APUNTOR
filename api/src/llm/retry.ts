import type { GenAiModels } from './vertex';

/**
 * Reintentos ante límites de uso de la IA (429) o saturación temporal (503). El plan gratis de
 * la API de Gemini admite pocas peticiones por minuto: el worker espera lo que pida Google y
 * sigue; una pregunta del usuario solo reintenta una vez, breve, para no dejarlo esperando.
 */
export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Worker: un documento grande hace muchas llamadas seguidas y puede esperar. */
export const WORKER_AI_RETRY: RetryPolicy = { attempts: 8, baseDelayMs: 5_000, maxDelayMs: 65_000 };
/** API: la persona está esperando la respuesta. */
export const REQUEST_AI_RETRY: RetryPolicy = { attempts: 2, baseDelayMs: 1_500, maxDelayMs: 4_000 };

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

function statusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (typeof status === 'number') return status;
  }
  const match = /"code"\s*:\s*(\d{3})/u.exec(describe(error));
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** true si el error es un límite de uso o una saturación pasajera de la IA. */
export function isTransientAiError(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 429 || status === 503) return true;
  return /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/u.test(describe(error));
}

/** Espera que sugiere Google ("retryDelay": "17s"), si viene en el error. */
export function suggestedDelayMs(error: unknown): number | null {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/u.exec(describe(error));
  return match?.[1] === undefined ? null : Math.ceil(Number(match[1]) * 1000);
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function withAiRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientAiError(error) || attempt >= policy.attempts) throw error;
      const backoff = policy.baseDelayMs * 2 ** (attempt - 1);
      await wait(Math.min(policy.maxDelayMs, suggestedDelayMs(error) ?? backoff));
    }
  }
}

/** Envuelve el cliente de la IA para que todas sus llamadas reintenten ante límites. */
export function withRetries(
  models: GenAiModels,
  policy: RetryPolicy,
  wait?: (ms: number) => Promise<void>,
): GenAiModels {
  return {
    embedContent: (params) => withAiRetry(() => models.embedContent(params), policy, wait),
    generateContent: (params) => withAiRetry(() => models.generateContent(params), policy, wait),
  };
}
