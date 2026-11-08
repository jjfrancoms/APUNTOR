/**
 * Repetición espaciada (cajas tipo Leitner). Misma lógica que `app/src/lib/flashcards.ts`; un
 * test comprueba que no se separen. El servidor es quien decide; la app la usa en la vista previa.
 *
 * - "Lo sé": sube de caja y la tarjeta vuelve dentro de más días.
 * - "Aún no lo sé": vuelve a la primera caja, así que mañana aparece otra vez.
 */
export const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export function nextBox(box: number, known: boolean): number {
  return known ? Math.min(box + 1, INTERVAL_DAYS.length - 1) : 0;
}

export function daysUntilNext(box: number): number {
  return INTERVAL_DAYS[Math.max(0, Math.min(box, INTERVAL_DAYS.length - 1))] ?? 1;
}

/** Suma días a una fecha `AAAA-MM-DD` sin depender de la zona horaria del servidor. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
