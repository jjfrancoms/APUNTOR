import { describe, expect, it } from 'vitest';
import {
  DRAFT_SETTLED_MS,
  FAILURES_TO_OFFLINE,
  isOfflineAfter,
  nextProbeDelay,
  shouldAutoSend,
} from '../src/lib/connectivity';

describe('detección de conexión', () => {
  it('un solo fallo no marca sin conexión', () => {
    expect(isOfflineAfter(FAILURES_TO_OFFLINE - 1)).toBe(false);
    expect(isOfflineAfter(FAILURES_TO_OFFLINE)).toBe(true);
  });

  it('comprueba antes cuando acaba de fallar', () => {
    expect(nextProbeDelay(1)).toBeLessThan(nextProbeDelay(0));
  });
});

describe('envío automático del borrador', () => {
  const now = 100_000;

  it('envía un borrador terminado', () => {
    expect(shouldAutoSend('¿Qué es un límite?', now - DRAFT_SETTLED_MS, now)).toBe(true);
  });

  it('no envía lo que se está escribiendo', () => {
    expect(shouldAutoSend('¿Qué es', now - 500, now)).toBe(false);
  });

  it('no envía un borrador vacío', () => {
    expect(shouldAutoSend('   ', 0, now)).toBe(false);
  });
});
