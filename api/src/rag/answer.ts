import { ApiError } from '../errors';
import type { EmbeddingProvider } from '../llm/embedding-provider';
import type { JsonGenerator, TokenUsage } from '../llm/vertex';
import type { QuotaService } from '../quota';
import { ANSWER_JSON_SCHEMA, validateAnswer, type VerifiedClaim } from './citations';
import { ABSTENTION_MESSAGE, buildRagPrompt, type ChunkSearch } from './retriever';

export type AbstentionReason = 'empty_question' | 'no_matches' | 'validation_failed';

export type QuestionResult =
  | { status: 'answered'; claims: VerifiedClaim[]; usage: TokenUsage }
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
  generator: JsonGenerator;
  quota: Pick<QuotaService, 'consume' | 'release'>;
}

function abstain(reason: AbstentionReason, extra: { detail?: string; usage?: TokenUsage } = {}) {
  return { status: 'abstained', message: ABSTENTION_MESSAGE, reason, ...extra } as const;
}

/**
 * pregunta → embedding → match_user_chunks → LLM en JSON → validador de citas.
 * Sin coincidencias se abstiene sin llamar al LLM y devuelve la pregunta a la cuota.
 */
export async function answerQuestion(
  deps: AnswerDeps,
  params: { userId: string; question: string; documentIds?: readonly string[] },
): Promise<QuestionResult> {
  const question = params.question.trim();
  if (question.length === 0) return abstain('empty_question');

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
    const { text, usage } = await deps.generator.generateJson({
      ...prompt,
      schema: ANSWER_JSON_SCHEMA,
    });
    llmCompleted = true;

    const validation = validateAnswer(text, chunks);
    if (!validation.valid) {
      return abstain('validation_failed', { detail: validation.reason, usage });
    }
    return { status: 'answered', claims: validation.claims, usage };
  } finally {
    // Si algo falló antes de responder, la pregunta no cuenta.
    if (!llmCompleted) await deps.quota.release(params.userId, 'questions', 1);
  }
}
