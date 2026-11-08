/** Reglas de la detección de conexión. Sin dependencias nativas: se prueban solas. */

export const PROBE_TIMEOUT_MS = 5_000;
const PROBE_ONLINE_MS = 20_000;
const PROBE_SUSPECT_MS = 4_000;

/** Un solo fallo puede ser un cambio de wifi a datos: hacen falta dos seguidos. */
export const FAILURES_TO_OFFLINE = 2;

/** Espera hasta la siguiente comprobación: corta si hubo fallos, para detectar pronto el cambio. */
export function nextProbeDelay(failures: number): number {
  return failures > 0 ? PROBE_SUSPECT_MS : PROBE_ONLINE_MS;
}

export function isOfflineAfter(failures: number): boolean {
  return failures >= FAILURES_TO_OFFLINE;
}

/** Sin escribir durante este tiempo se considera que la pregunta estaba terminada. */
export const DRAFT_SETTLED_MS = 3_000;

/** Al volver la conexión solo se envía un borrador terminado, nunca uno que se está escribiendo. */
export function shouldAutoSend(draft: string, lastEditAt: number, now: number): boolean {
  return draft.trim().length > 0 && now - lastEditAt >= DRAFT_SETTLED_MS;
}
