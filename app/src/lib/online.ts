import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { config } from './config';
import { isOfflineAfter, nextProbeDelay, PROBE_TIMEOUT_MS } from './connectivity';

// Se parte de "con conexión" para no mostrar un aviso falso al abrir la app.
let online = true;
let checkNow: (() => void) | null = null;
let stopMonitor: (() => void) | null = null;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (next === online) return;
  online = next;
  listeners.forEach((listener) => listener());
}

function monitorBrowser(): () => void {
  const read = () => publish(navigator.onLine);
  checkNow = read;
  read();
  window.addEventListener('online', read);
  window.addEventListener('offline', read);
  return () => {
    window.removeEventListener('online', read);
    window.removeEventListener('offline', read);
  };
}

/** Cualquier respuesta cuenta, también un error: lo que importa es que el servidor contestó. */
async function reachesServer(): Promise<boolean> {
  if (!config.apiUrl) return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${config.apiUrl}/health`, { cache: 'no-store', signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * En el teléfono se pregunta al propio servidor (`/health`, sin límite de peticiones). Si el
 * servidor está caído se ve igual que sin internet, y para el usuario el efecto es el mismo.
 */
function monitorByProbing(): () => void {
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let stopped = false;

  const probe = async () => {
    if (running || stopped) return;
    running = true;
    clearTimeout(timer);
    const ok = await reachesServer();
    running = false;
    if (stopped) return;
    failures = ok ? 0 : failures + 1;
    if (ok) publish(true);
    else if (isOfflineAfter(failures)) publish(false);
    // En segundo plano no se gasta batería: se retoma al volver a la app.
    if (AppState.currentState === 'active') {
      timer = setTimeout(() => void probe(), nextProbeDelay(failures));
    }
  };

  checkNow = () => void probe();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') void probe();
    else clearTimeout(timer);
  });
  void probe();
  return () => {
    stopped = true;
    clearTimeout(timer);
    subscription.remove();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  stopMonitor ??= Platform.OS === 'web' ? monitorBrowser() : monitorByProbing();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopMonitor?.();
      stopMonitor = null;
      checkNow = null;
    }
  };
}

function isOnline(): boolean {
  return online;
}

/** true si hay conexión con el servidor; la pantalla se actualiza sola cuando cambia. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}

/** Comprueba ya la conexión, sin esperar a la siguiente vuelta (por ejemplo, tras un fallo). */
export function checkConnection(): void {
  checkNow?.();
}
