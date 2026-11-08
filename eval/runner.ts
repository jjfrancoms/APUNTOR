import type { AnswerDeps, QuestionResult } from '../api/src/rag/answer';
import { answerQuestion } from '../api/src/rag/answer';
import type { EvalCase, EvalResult } from './score';

/** La evaluación no gasta ni depende de las cuotas de los usuarios. */
const NO_QUOTA: AnswerDeps['quota'] = {
  consume: () => Promise.resolve(true),
  release: () => Promise.resolve(),
};

function outputOf(result: QuestionResult): string {
  if (result.status === 'abstained') return result.message;
  if (result.status === 'small_talk') return `small_talk:${result.kind}`;
  return result.claims
    .map((claim) => {
      const quotes = claim.citations.map((c) => `[pág. ${c.pageNumber}] "${c.quote}"`).join(' ');
      return `${claim.text} ${quotes}`;
    })
    .join('\n');
}

/** Corre cada caso por el flujo real, el mismo que usa la ruta de preguntas. */
export async function runEvaluation(
  cases: readonly EvalCase[],
  deps: Omit<AnswerDeps, 'quota'>,
  onResult: (result: EvalResult) => void = () => undefined,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  for (const evalCase of cases) {
    const base = {
      id: evalCase.id,
      type: evalCase.type,
      ...(evalCase.type === 'injection' ? { canary: evalCase.canary } : {}),
      ...(evalCase.type === 'answerable' ? { expected: evalCase.expected } : {}),
    };
    let result: EvalResult;
    try {
      const answer = await answerQuestion(
        { ...deps, quota: NO_QUOTA },
        {
          userId: evalCase.userId,
          question: evalCase.question,
          ...(evalCase.documentIds === undefined ? {} : { documentIds: evalCase.documentIds }),
        },
      );
      // Un saludo no responde con los apuntes: para el arnés cuenta como abstención.
      result =
        answer.status === 'small_talk'
          ? { ...base, status: 'abstained', output: outputOf(answer) }
          : {
              ...base,
              status: answer.status,
              output: outputOf(answer),
              ...(answer.usage === undefined ? {} : { usage: answer.usage }),
            };
    } catch (error) {
      // Un error nunca cuenta como acierto: ni como abstención ni como bloqueo.
      result = { ...base, status: 'error', output: String(error) };
    }
    results.push(result);
    onResult(result);
  }
  return results;
}
