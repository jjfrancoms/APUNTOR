import type { ContentItem } from '@/store/content';

export interface QuizQuestion {
  id: string;
  prompt: string;
  /** Descripción completa tomada del documento (sin recortes), si la pregunta la usa. */
  quote?: string;
  options: string[];
  answer: number;
  klass: number;
  page: number;
  explanation: string;
}

/**
 * Arma preguntas de opción múltiple con el contenido de una clase.
 *
 * Formato: la pregunta muestra la descripción completa tomada del documento y
 * las opciones son nombres de temas del mismo curso (cortos, nunca se recortan
 * y no delatan la respuesta por su longitud). La posición de la correcta rota
 * de forma determinista para que no quede siempre en el mismo lugar.
 */
export function buildQuiz(items: readonly ContentItem[], classId: string): QuizQuestion[] {
  const own = items.filter((i) => i.classId === classId && i.kind !== 'ejercicio');
  const courseId = own[0]?.courseId;
  const pool = items.filter((i) => i.courseId === courseId && i.kind !== 'ejercicio');
  return own.map((item, idx) => {
    const others = pool.filter((p) => p.id !== item.id && p.title !== item.title);
    // Distractores: primero los de la misma clase, luego del resto del curso.
    const sameClass = others.filter((o) => o.classId === item.classId);
    const rest = others.filter((o) => o.classId !== item.classId);
    const distractors = [...sameClass, ...rest.slice(idx), ...rest.slice(0, idx)].slice(0, 3);
    const answer = idx % (distractors.length + 1);
    const options = distractors.map((d) => d.title);
    options.splice(answer, 0, item.title);
    return {
      id: `auto-${item.id}`,
      prompt: '¿A qué tema corresponde esta descripción?',
      quote: item.text,
      options,
      answer,
      klass: item.klass,
      page: item.page,
      explanation: `${item.title}: ${item.text}`,
    };
  });
}
