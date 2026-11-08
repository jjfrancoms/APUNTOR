import { File } from 'expo-file-system';

/** Mide el archivo que se va a subir: la API rechaza la subida si el tamaño no coincide. */
export function photoSizeBytes(asset: { uri: string; file?: Blob; fileSize?: number }): number {
  return new File(asset.uri).size;
}
