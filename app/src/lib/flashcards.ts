/**
 * Repetición espaciada de las flashcards (sistema de cajas tipo Leitner).
 *
 * - "Lo sé": la tarjeta sale de la sesión y sube de caja; vuelve dentro de más días.
 * - "Aún no lo sé": vuelve al final de la sesión de hoy (la verás otra vez antes de terminar)
 *   y regresa a la primera caja, así que mañana vuelve a aparecer.
 */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export function nextBox(box: number, known: boolean): number {
  return known ? Math.min(box + 1, INTERVAL_DAYS.length - 1) : 0;
}

export function daysUntilNext(box: number): number {
  return INTERVAL_DAYS[Math.max(0, Math.min(box, INTERVAL_DAYS.length - 1))] ?? 1;
}

export interface CardSession {
  /** Tarjetas pendientes; la primera es la que se muestra. */
  queue: string[];
  /** Resultado de cada tarjeta la primera vez que se respondió. */
  firstTry: Record<string, boolean>;
  total: number;
}

export function startSession(ids: readonly string[]): CardSession {
  return { queue: [...ids], firstTry: {}, total: ids.length };
}

export function answerCard(session: CardSession, known: boolean): CardSession {
  const [current, ...rest] = session.queue;
  if (current === undefined) return session;
  const firstTry =
    current in session.firstTry ? session.firstTry : { ...session.firstTry, [current]: known };
  return { ...session, firstTry, queue: known ? rest : [...rest, current] };
}

/** Tarjetas ya aprendidas en la sesión (las que salieron de la cola). */
export function learnedCount(session: CardSession): number {
  return session.total - new Set(session.queue).size;
}

export function knownFirstTry(session: CardSession): number {
  return Object.values(session.firstTry).filter(Boolean).length;
}
