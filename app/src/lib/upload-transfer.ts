import type { PickedFile } from '@/store/store';

/** En web, el selector entrega el `File` del navegador. */
export async function putFile(
  url: string,
  headers: Record<string, string>,
  file: PickedFile,
): Promise<void> {
  if (!file.webFile) throw new Error('Archivo no disponible');
  const response = await fetch(url, { method: 'PUT', headers, body: file.webFile });
  if (!response.ok) throw new Error(`R2 respondió HTTP ${response.status}`);
}
