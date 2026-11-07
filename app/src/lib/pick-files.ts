import * as DocumentPicker from 'expo-document-picker';
import { fileFromPicker, type PickedFile } from '@/store/store';

/** Abre el selector de archivos del sistema (también funciona en web). */
export async function pickFiles(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    // Copia al caché: así la app puede leer el archivo para subirlo.
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map(fileFromPicker);
}
