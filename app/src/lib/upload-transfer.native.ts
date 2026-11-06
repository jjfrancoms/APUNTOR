import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import type { PickedFile } from '@/store/store';

/** Sube el archivo directo a R2 con la URL prefirmada (el `File` de Expo es un Blob). */
export async function putFile(
  url: string,
  headers: Record<string, string>,
  file: PickedFile,
): Promise<void> {
  const response = await fetch(url, { method: 'PUT', headers, body: new File(file.uri) });
  if (!response.ok) throw new Error(`R2 respondió HTTP ${response.status}`);
}
