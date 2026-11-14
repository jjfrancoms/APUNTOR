import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Estado compartido: una sola consulta y una sola suscripción al sistema, aunque haya decenas
 * de controles que lo lean (cada `Tap` lo usa).
 */
let current = false;
let started = false;
const listeners = new Set<() => void>();

function set(next: boolean): void {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

function start(): void {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then(set)
    .catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `true` si el usuario pidió reducir el movimiento en su sistema (iOS, Android y web). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => false,
  );
}
