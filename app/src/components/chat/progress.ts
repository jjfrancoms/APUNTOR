/** Fase del aviso de "buscando" según el tiempo que lleva esperando la respuesta. */
export type ProgressPhase = 'searching' | 'longer' | 'slow';

/** Hasta aquí es una búsqueda normal (ms). */
export const PROGRESS_LONGER_MS = 8_000;
/** Desde aquí avisamos que está tardando más de lo normal y ofrecemos detenerla (ms). */
export const PROGRESS_SLOW_MS = 25_000;

/** Fase según los milisegundos transcurridos desde que se envió la pregunta. */
export function progressPhase(elapsedMs: number): ProgressPhase {
  if (!Number.isFinite(elapsedMs) || elapsedMs < PROGRESS_LONGER_MS) return 'searching';
  if (elapsedMs <= PROGRESS_SLOW_MS) return 'longer';
  return 'slow';
}
