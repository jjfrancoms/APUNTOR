/**
 * Repetición espaciada (cajas tipo Leitner). Las reglas son el módulo puro de la app, sin copia:
 * el servidor es quien decide y la app las usa en la vista previa.
 *
 * - "Lo sé": sube de caja y la tarjeta vuelve dentro de más días.
 * - "Aún no lo sé": vuelve a la primera caja, así que mañana aparece otra vez.
 */
export { daysUntilNext, INTERVAL_DAYS, nextBox } from '../../../app/src/lib/flashcards';

/** Suma días a una fecha `AAAA-MM-DD` sin depender de la zona horaria del servidor. */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
