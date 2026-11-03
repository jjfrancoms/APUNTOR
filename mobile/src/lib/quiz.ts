import type { ContentItem } from '@/store/content';

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  klass: number;
  page: number;
  explanation: string;
}

function shorten(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Arma preguntas de opción múltiple con el contenido de una clase: la opción
 * correcta es el texto del propio elemento y las incorrectas, otros elementos
 * del mismo curso. La posición de la correcta rota de forma determinista.
 */
export function buildQuiz(items: readonly ContentItem[], classId: string): QuizQuestion[] {
  const own = items.filter((i) => i.classId === classId && i.kind !== 'ejercicio');
  const courseId = own[0]?.courseId;
  const pool = items.filter((i) => i.courseId === courseId && i.kind !== 'ejercicio');
  return own.map((item, idx) => {
    const distractors = pool.filter((p) => p.id !== item.id).slice(idx, idx + 3);
    while (distractors.length < 3 && pool.length > distractors.length + 1) {
      const next = pool.find((p) => p.id !== item.id && !distractors.includes(p));
      if (!next) break;
      distractors.push(next);
    }
    const answer = idx % (distractors.length + 1);
    const options = distractors.map((d) => shorten(d.text));
    options.splice(answer, 0, shorten(item.text));
    return {
      id: `auto-${item.id}`,
      prompt: `¿Qué describe mejor «${item.title}»?`,
      options,
      answer,
      klass: item.klass,
      page: item.page,
      explanation: item.text,
    };
  });
}
