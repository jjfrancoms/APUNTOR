import { Directory, File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

/** Cómo terminó el guardado: `cancelled` es que la persona cerró el selector. */
export type SaveResult = 'saved' | 'cancelled' | 'failed';

/** El selector de carpetas de Android rechaza la promesa al cerrarlo sin elegir. */
function wasCancelled(error: unknown): boolean {
  return error instanceof Error && /cancel/iu.test(error.message);
}

/** Android: la persona elige la carpeta y el archivo queda ahí. */
async function saveAndroid(fileName: string, json: string): Promise<SaveResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (error) {
    return wasCancelled(error) ? 'cancelled' : 'failed';
  }
  directory.createFile(fileName, 'application/json').write(json);
  return 'saved';
}

/** iOS: hoja de compartir con un archivo temporal, que se borra al terminar. */
async function saveIos(fileName: string, json: string): Promise<SaveResult> {
  const file = new File(Paths.cache, fileName);
  try {
    file.create({ overwrite: true });
    file.write(json);
    const shared = await Share.share({ url: file.uri });
    return shared.action === Share.dismissedAction ? 'cancelled' : 'saved';
  } finally {
    // Son datos personales: no se quedan en el caché.
    if (file.exists) file.delete();
  }
}

/**
 * Guarda el JSON como archivo, sin módulos nativos que no estén en Expo Go (por eso no usa
 * `expo-sharing`). `Share` con el texto no sirve: en Android tiene un tope cercano a 1 MB.
 */
export async function saveJsonFile(fileName: string, json: string): Promise<SaveResult> {
  try {
    return await (Platform.OS === 'android' ? saveAndroid : saveIos)(fileName, json);
  } catch {
    return 'failed';
  }
}
