/** Cómo terminó el guardado: `cancelled` es que la persona cerró el selector. */
export type SaveResult = 'saved' | 'cancelled' | 'failed';

/** Web: descarga el archivo con un enlace a un Blob. */
export function saveJsonFile(fileName: string, json: string): Promise<SaveResult> {
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // El navegador ya tomó el archivo: se libera en el siguiente turno.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return Promise.resolve('saved');
  } catch {
    return Promise.resolve('failed');
  }
}
