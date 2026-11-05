/** Utilidades del calendario (sin dependencias). Los meses van de 0 a 11, como en `Date`. */

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Celdas del mes en semanas que empiezan el lunes: `null` son huecos antes del día 1 y
 * después del último día, para completar filas de 7.
 */
export function monthGrid(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatDayMonthYear(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
}

export function isAfterDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() * 10_000 + a.getMonth() * 100 + a.getDate() >
    b.getFullYear() * 10_000 + b.getMonth() * 100 + b.getDate()
  );
}

/** Años elegibles, del más reciente al más antiguo. */
export function yearRange(maxYear: number, minYear = 1900): number[] {
  return Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
}
