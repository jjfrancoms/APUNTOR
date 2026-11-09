import { useCallback, useEffect, useState } from 'react';
import { toStudyError, type StudyErrorCode } from './study';

export type StudyLoad<T> =
  { state: 'loading' } | { state: 'error'; code: StudyErrorCode } | { state: 'ready'; data: T };

/**
 * Carga datos del estudio con sus estados (cargando, error, listo). `demo` fuerza un estado
 * en la vista previa: `loading`, `error` u `offline`. `fetcher` debe ser estable (useCallback).
 */
export function useStudyLoad<T>(
  fetcher: () => Promise<T>,
  demo?: string,
): { load: StudyLoad<T>; reload: () => void } {
  const [load, setLoad] = useState<StudyLoad<T>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo === 'loading') return;
    if (demo === 'error' || demo === 'offline') {
      setLoad({ state: 'error', code: demo === 'offline' ? 'NET' : 'GENERIC' });
      return;
    }
    let active = true;
    setLoad({ state: 'loading' });
    fetcher().then(
      (data) => active && setLoad({ state: 'ready', data }),
      (error: unknown) => active && setLoad({ state: 'error', code: toStudyError(error) }),
    );
    return () => {
      active = false;
    };
  }, [fetcher, demo, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { load, reload };
}
