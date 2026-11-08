import { ApiRequestError, type ApiReviewItem, type ApiStudyItem } from './api';

/** Códigos del servidor que la pantalla de estudio explica con un texto propio. */
export const STUDY_ERROR_CODES = [
  'DOC_NOT_FOUND',
  'DOC_STATE',
  'STUDY_NO_CONTENT',
  'STUDY_TOO_FEW_ITEMS',
  'STUDY_DAILY_LIMIT',
  'RATE_LIMITED',
  'STUDY_FAILED',
  'TIMEOUT',
  'NET',
  'GENERIC',
] as const;
export type StudyErrorCode = (typeof STUDY_ERROR_CODES)[number];

/** Traduce un fallo de la API al texto que se le enseña al usuario. */
export function toStudyError(error: unknown): StudyErrorCode {
  if (!(error instanceof ApiRequestError)) return 'GENERIC';
  if (error.code === 'NETWORK' || error.code === 'NOT_CONFIGURED') return 'NET';
  if (error.code === 'TIMEOUT') return 'TIMEOUT';
  const known = STUDY_ERROR_CODES.find((code) => code === error.code);
  return known ?? 'GENERIC';
}

/** El usuario canceló la generación: no es un error que se muestre. */
export function isCancelled(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'CANCELLED';
}

/** Cantidades de preguntas o tarjetas que acepta el servidor (3 a 20). */
export const STUDY_COUNTS = ['5', '10', '15', '20'] as const;
export type StudyCount = (typeof STUDY_COUNTS)[number];

export function clampCount(n: number): number {
  return Math.max(3, Math.min(20, Math.round(n)));
}

/** Minutos aproximados que lleva un juego (unos 50 s por pregunta, mínimo 2). */
export function estimateMinutes(count: number): number {
  return Math.max(2, Math.round(count * 0.8));
}

/** Cuántas generaciones quedan hoy (nunca negativo). */
export function generationsLeft(used: number, limit: number): number {
  return Math.max(0, limit - used);
}

/** Cara y dorso de una tarjeta; si el elemento es una pregunta, el dorso es su respuesta. */
export function cardFace(item: ApiStudyItem): { front: string; back: string } {
  if (item.kind === 'cards') return { front: item.front, back: item.back };
  return { front: item.question, back: item.options[item.correctIndex] ?? item.explanation };
}

export interface CourseCount {
  course: string | null;
  cards: number;
}

/** Cuenta las tarjetas de hoy por curso, en el orden en que aparece cada uno. */
export function reviewByCourse(items: readonly ApiReviewItem[]): CourseCount[] {
  const rows = new Map<string | null, number>();
  for (const item of items) {
    rows.set(item.courseTitle, (rows.get(item.courseTitle) ?? 0) + 1);
  }
  return [...rows].map(([course, cards]) => ({ course, cards }));
}
