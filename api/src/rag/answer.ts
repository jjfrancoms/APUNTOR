import { ApiError } from '../errors';
import type { EmbeddingProvider } from '../llm/embedding-provider';
import { isTransientAiError } from '../llm/retry';
import type { JsonGenerator, LlmResult, TokenUsage } from '../llm/vertex';
import type { QuotaService } from '../quota';
import { ANSWER_JSON_SCHEMA, validateAnswer, type VerifiedClaim } from './citations';
import { detectSmallTalk, type SmallTalk } from './small-talk';
import { ABSTENTION_MESSAGE, buildRagPrompt, type ChunkSearch } from './retriever';

export type AbstentionReason = 'empty_question' | 'no_matches' | 'validation_failed';

export type QuestionResult =
  | { status: 'answered'; claims: VerifiedClaim[]; usage: TokenUsage }
  /** Saludo o cortesía: la app responde con su propio texto, sin buscar ni gastar cuota. */
  | { status: 'small_talk'; kind: SmallTalk }
  | {
      status: 'abstained';
      message: string;
      reason: AbstentionReason;
      /** Motivo técnico del validador, para el arnés de evaluación. */
      detail?: string;
      usage?: TokenUsage;
    };

export interface AnswerDeps {
  embedder: EmbeddingProvider;
  search: ChunkSearch;
  /** Modelo rápido: el primer intento (el estudiante está esperando). */
  generator: JsonGenerator;
  /**
   * Modelo fuerte: un solo segundo intento si la respuesta rápida no pasa el validador de citas
   * o la llamada falla con un error no pasajero. Sin él, se abstiene directamente.
   */
  fallbackGenerator?: JsonGenerator;
  quota: Pick<QuotaService, 'consume' | 'release'>;
}

const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  promptTokens: a.promptTokens + b.promptTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  thoughtsTokens: a.thoughtsTokens + b.thoughtsTokens,
});

function toResult(
  validation: ReturnType<typeof validateAnswer>,
  usage: TokenUsage,
): QuestionResult {
  if (!validation.valid) return abstain('validation_failed', { detail: validation.reason, usage });
  return { status: 'answered', claims: validation.claims, usage };
}

function abstain(reason: AbstentionReason, extra: { detail?: string; usage?: TokenUsage } = {}) {
  return { status: 'abstained', message: ABSTENTION_MESSAGE, reason, ...extra } as const;
}

/**
 * pregunta → embedding → match_user_chunks → LLM en JSON → validador de citas.
 * Sin coincidencias se abstiene sin llamar al LLM y devuelve la pregunta a la cuota.
 * Primero responde el modelo rápido; si su respuesta no pasa el validador (o falla con un error
 * que no es pasajero), se intenta UNA vez con el fuerte antes de abstenerse. Sigue siendo una
 * sola pregunta de la cuota, y se devuelve si ningún modelo llegó a responder.
 */
export async function answerQuestion(
  deps: AnswerDeps,
  params: {
    userId: string;
    question: string;
    documentIds?: readonly string[];
    /** El estudiante detuvo la pregunta: se corta la IA y la pregunta no cuenta. */
    signal?: AbortSignal;
  },
): Promise<QuestionResult> {
  const question = params.question.trim();
  if (question.length === 0) return abstain('empty_question');
  const smallTalk = detectSmallTalk(question);
  if (smallTalk) return { status: 'small_talk', kind: smallTalk };

  if (!(await deps.quota.consume(params.userId, 'questions', 1))) {
    throw new ApiError('CHAT_DAILY_LIMIT', 429);
  }

  let llmCompleted = false;
  try {
    const [queryEmbedding] = await deps.embedder.embed([question], 'query');
    if (queryEmbedding === undefined) throw new Error('El proveedor no devolvió embedding');

    const chunks = await deps.search({
      userId: params.userId,
      queryEmbedding,
      ...(params.documentIds === undefined ? {} : { documentIds: params.documentIds }),
    });
    if (chunks.length === 0) {
      await deps.quota.release(params.userId, 'questions', 1);
      llmCompleted = true; // Ya se devolvió: el finally no debe devolverla otra vez.
      return abstain('no_matches');
    }

    const prompt = buildRagPrompt(question, chunks);
    if (params.signal?.aborted) throw new Error('Pregunta detenida');
    const request = {
      ...prompt,
      schema: ANSWER_JSON_SCHEMA,
      ...(params.signal ? { signal: params.signal } : {}),
    };
    const fallback = deps.fallbackGenerator;

    // Primer intento con el modelo rápido.
    let first: LlmResult;
    try {
      first = await deps.generator.generateJson(request);
    } catch (error) {
      // Detenida, límite de uso o sin modelo fuerte: se propaga y la pregunta no cuenta.
      if (!fallback || params.signal?.aborted || isTransientAiError(error)) throw error;
      const second = await fallback.generateJson(request);
      llmCompleted = true;
      return toResult(validateAnswer(second.text, chunks), second.usage);
    }
    const validation = validateAnswer(first.text, chunks);
    if (validation.valid || !fallback) {
      llmCompleted = true;
      return toResult(validation, first.usage);
    }

    // La respuesta rápida no pasó el validador: un segundo intento con el modelo fuerte.
    if (params.signal?.aborted) throw new Error('Pregunta detenida');
    let second: LlmResult;
    try {
      second = await fallback.generateJson(request);
    } catch (error) {
      if (params.signal?.aborted) throw error;
      // Un fallo del segundo intento no se reintenta más.
      // El modelo rápido sí respondió: la pregunta cuenta y se abstiene con su motivo.
      llmCompleted = true;
      return abstain('validation_failed', { detail: validation.reason, usage: first.usage });
    }
    llmCompleted = true;
    return toResult(validateAnswer(second.text, chunks), addUsage(first.usage, second.usage));
  } finally {
    // Si algo falló antes de responder, la pregunta no cuenta.
    if (!llmCompleted) await deps.quota.release(params.userId, 'questions', 1);
  }
}
