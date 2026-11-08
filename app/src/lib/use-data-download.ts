import { useCallback, useRef, useState } from 'react';
import { useStrings } from '@/i18n/es';
import { saveJsonFile } from '@/lib/save-json';
import { exportAccountData } from '@/store/store';

const EXPORT_FILE_NAME = 'apuntor-mis-datos.json';

/** "Descargar mis datos": pide la exportación completa y la guarda como archivo. */
export function useDataDownload() {
  const s = useStrings();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setDone(false);
    setError(null);
    try {
      const exported = await exportAccountData();
      if (!exported.ok) {
        setError(s.errors[exported.error]);
        return;
      }
      const saved = await saveJsonFile(EXPORT_FILE_NAME, exported.json);
      if (saved === 'saved') setDone(true);
      else if (saved === 'failed') setError(s.dataExport.saveFailed);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [s]);

  return { busy, done, error, run };
}
