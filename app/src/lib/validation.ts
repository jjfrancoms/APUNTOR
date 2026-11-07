export const MIN_PASSWORD_LENGTH = 8;

export function isWeakPassword(password: string): boolean {
  return password.length < MIN_PASSWORD_LENGTH;
}

/**
 * Contraseña nueva escrita dos veces (registro y recuperación): 8+ caracteres e iguales.
 * Devuelve el código de error que se muestra, o null si es válida.
 */
export function validateNewPassword(
  password: string,
  confirm: string,
): 'AUTH_WEAK_PASSWORD' | 'AUTH_PASSWORD_MISMATCH' | null {
  if (isWeakPassword(password)) return 'AUTH_WEAK_PASSWORD';
  if (password !== confirm) return 'AUTH_PASSWORD_MISMATCH';
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
}

export const ADULT_AGE = 18;

/** Formatea lo que el usuario escribe como DD/MM/AAAA (solo dígitos, agrega las barras). */
export function formatBirthInput(raw: string): string {
  const d = raw.replace(/\D/gu, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "DD/MM/AAAA" → fecha válida (sin 31/02, sin futuro, año ≥ 1900) o null. */
export function parseBirthDate(text: string, today: Date = new Date()): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(text.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!real || year < 1900 || date > today) return null;
  return date;
}

export function ageOn(birth: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
