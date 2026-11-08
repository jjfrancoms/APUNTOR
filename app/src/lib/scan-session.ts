import { useSyncExternalStore } from 'react';
import { MAX_SCAN_PAGES, type ScanPage } from './scan';

export interface ScanSession {
  pages: readonly ScanPage[];
  /** El sistema negó la cámara: la pantalla 28 muestra el estado 47. */
  cameraDenied: boolean;
}

const EMPTY: ScanSession = { pages: [], cameraDenied: false };

// Solo en memoria: son fotos de apuntes y no deben quedar en el dispositivo tras escanear.
let session = EMPTY;
const listeners = new Set<() => void>();

function update(next: ScanSession): void {
  session = next;
  listeners.forEach((listener) => listener());
}

export function getScanSession(): ScanSession {
  return session;
}

/** Agrega páginas hasta el tope. Devuelve cuántas entraron. */
export function addScanPages(pages: readonly ScanPage[]): number {
  const room = Math.max(0, MAX_SCAN_PAGES - session.pages.length);
  const accepted = pages.slice(0, room);
  if (accepted.length > 0) update({ ...session, pages: [...session.pages, ...accepted] });
  return accepted.length;
}

/** Repetir una foto: la nueva ocupa el lugar de la anterior. */
export function replaceScanPage(id: string, page: ScanPage): void {
  update({ ...session, pages: session.pages.map((p) => (p.id === id ? page : p)) });
}

export function removeScanPage(id: string): void {
  update({ ...session, pages: session.pages.filter((p) => p.id !== id) });
}

export function setCameraDenied(cameraDenied: boolean): void {
  if (session.cameraDenied !== cameraDenied) update({ ...session, cameraDenied });
}

export function clearScan(): void {
  if (session !== EMPTY) update(EMPTY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useScanSession(): ScanSession {
  return useSyncExternalStore(subscribe, getScanSession, getScanSession);
}
