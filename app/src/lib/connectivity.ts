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
