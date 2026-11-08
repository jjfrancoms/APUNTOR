import { describe, expect, it } from 'vitest';
import { FAILURES_TO_OFFLINE, isOfflineAfter, nextProbeDelay } from '../src/lib/connectivity';

describe('detección de conexión', () => {
  it('un solo fallo no marca sin conexión', () => {
    expect(isOfflineAfter(FAILURES_TO_OFFLINE - 1)).toBe(false);
    expect(isOfflineAfter(FAILURES_TO_OFFLINE)).toBe(true);
  });

  it('comprueba antes cuando acaba de fallar', () => {
    expect(nextProbeDelay(1)).toBeLessThan(nextProbeDelay(0));
  });
});
