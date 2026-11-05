/** Precios de ejemplo (por definir con negocio). En soles. */
export const STUDENT_MONTHLY = 14;
export const YEARLY_DISCOUNT = 0.2;

export function formatSoles(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `S/ ${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

/** Precio del plan Estudiante según la facturación. */
export function studentPrice(billing: 'monthly' | 'yearly') {
  if (billing === 'monthly') return { perMonth: STUDENT_MONTHLY, total: STUDENT_MONTHLY };
  const perMonth = STUDENT_MONTHLY * (1 - YEARLY_DISCOUNT);
  return {
    perMonth,
    total: perMonth * 12,
    before: STUDENT_MONTHLY,
    savedPerYear: STUDENT_MONTHLY * 12 - perMonth * 12,
  };
}
