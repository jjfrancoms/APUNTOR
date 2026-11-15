/** Precios de los planes, en soles e IGV incluido. */
export const STUDENT_MONTHLY = 19.9;
/** Pago único anual (el ahorro que se comunica es del 20 %). */
export const STUDENT_YEARLY = 189;
/** Pase de exámenes: 7 días, pago único, sin renovación automática. */
export const EXAM_PASS = 9.9;

export function formatSoles(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `S/ ${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** Precio del plan Estudiante según la facturación. */
export function studentPrice(billing: 'monthly' | 'yearly') {
  if (billing === 'monthly') return { perMonth: STUDENT_MONTHLY, total: STUDENT_MONTHLY };
  return {
    perMonth: STUDENT_YEARLY / 12,
    total: STUDENT_YEARLY,
    before: STUDENT_MONTHLY,
    savedPerYear: STUDENT_MONTHLY * 12 - STUDENT_YEARLY,
  };
}
