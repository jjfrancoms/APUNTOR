import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { photoSizeBytes } from './photo-size';
import { photoExtension, type ScanPage } from './scan';

export type ScanCapture =
  | { status: 'ok'; pages: ScanPage[] }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'failed' };

/**
 * `Compatible` pide a iOS un JPEG en vez del HEIC original. Si aun así llega HEIC se sube como
 * tal (`photoExtension` lo nombra bien y la API lo admite).
 */
const BASE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.85,
  exif: false,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

let sequence = 0;

function toPage(asset: ImagePicker.ImagePickerAsset): ScanPage | null {
  const sizeBytes = photoSizeBytes({
    uri: asset.uri,
    ...(asset.file ? { file: asset.file } : {}),
    ...(asset.fileSize !== undefined ? { fileSize: asset.fileSize } : {}),
  });
  if (sizeBytes <= 0) return null;
  sequence += 1;
  return {
    id: `scan-${Date.now()}-${sequence}`,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    sizeBytes,
    extension: photoExtension(asset),
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    capturedAt: Date.now(),
    ...(asset.file ? { webFile: asset.file } : {}),
  };
}

function capture(result: ImagePicker.ImagePickerResult): ScanCapture {
  if (result.canceled) return { status: 'canceled' };
  const pages = result.assets.map(toPage).filter((p): p is ScanPage => p !== null);
  return pages.length > 0 ? { status: 'ok', pages } : { status: 'failed' };
}

// En teléfono, un segundo toque mientras abre el selector haría fallar al primero. En web no se
// bloquea: un navegador sin el evento `cancel` nunca resolvería y el botón quedaría muerto.
let launching = false;

async function launch(open: () => Promise<ScanCapture>): Promise<ScanCapture> {
  if (Platform.OS === 'web') {
    return open().catch((): ScanCapture => ({ status: 'failed' }));
  }
  if (launching) return { status: 'canceled' };
  launching = true;
  try {
    return await open();
  } catch {
    return { status: 'failed' };
  } finally {
    launching = false;
  }
}

/** Abre la cámara (en web, el selector de archivos o la cámara del navegador). */
export function takePhoto(): Promise<ScanCapture> {
  return launch(async () => {
    // En web el selector debe abrirse dentro del gesto del usuario y no pide permisos.
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
    }
    return capture(await ImagePicker.launchCameraAsync(BASE_OPTIONS));
  });
}

/** Abre la galería con selección múltiple; no necesita permiso (usa el selector del sistema). */
export function pickPhotos(limit: number): Promise<ScanCapture> {
  return launch(async () =>
    capture(
      await ImagePicker.launchImageLibraryAsync({
        ...BASE_OPTIONS,
        allowsMultipleSelection: true,
        selectionLimit: limit,
      }),
    ),
  );
}

/** Indica si el permiso de cámara ya está concedido (al volver de Ajustes). */
export async function cameraAllowed(): Promise<boolean> {
  try {
    return (await ImagePicker.getCameraPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Android puede cerrar la app mientras la cámara está abierta: recupera esa foto al volver. */
export async function recoverPendingPhotos(): Promise<ScanPage[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const pending = await ImagePicker.getPendingResultAsync();
    if (!pending || 'code' in pending) return [];
    const result = capture(pending);
    return result.status === 'ok' ? result.pages : [];
  } catch {
    return [];
  }
}
