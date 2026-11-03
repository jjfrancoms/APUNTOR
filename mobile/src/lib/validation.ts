export const MIN_PASSWORD_LENGTH = 8;

export function isWeakPassword(password: string): boolean {
  return password.length < MIN_PASSWORD_LENGTH;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());
}
