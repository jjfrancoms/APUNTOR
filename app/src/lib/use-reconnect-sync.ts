import { useEffect, useRef } from 'react';
import { networkFailedUploads, refreshAll, retryNetworkUploads, useStore } from '@/store/store';
import { checkConnection, useOnline } from './online';

/**
 * Se monta una sola vez en la raíz. Al volver la conexión reintenta las subidas cortadas por
 * la red y recarga los datos. Solo actúa en ese cambio: un error de red que no sea de conexión
 * (p. ej. del almacenamiento) no se reintenta en bucle.
 */
export function useReconnectSync(): void {
  const online = useOnline();
  const failures = useStore((st) => networkFailedUploads(st).length);
  const wasOnline = useRef(online);

  useEffect(() => {
    if (online && !wasOnline.current) {
      retryNetworkUploads();
      void refreshAll();
    }
    wasOnline.current = online;
  }, [online]);

  // Una subida cortada es la primera pista de un corte: se comprueba sin esperar la vuelta.
  useEffect(() => {
    if (failures > 0) checkConnection();
  }, [failures]);
}
