/** Reglas del escáner de apuntes (pantallas 28 y 29). Sin dependencias nativas: se prueban solas. */

/** Tope por escaneo: cada foto es una subida y la API admite 20 por minuto. */
export const MAX_SCAN_PAGES = 20;

/** Lado corto mínimo, en píxeles, para que el texto de una hoja completa se lea con fiabilidad. */
export const MIN_READABLE_SIDE = 800;

export interface ScanPage {
  id: string;
  uri: string;
  width: number;
  height: number;
  /** Tamaño real del archivo: la API lo compara con lo que llega a R2. */
  sizeBytes: number;
  extension: string;
  mimeType?: string;
  capturedAt: number;
  /** Archivo del navegador (web). */
  webFile?: Blob;
}

/**
 * "Lectura poco clara": solo por resolución. La oscuridad exigiría leer los píxeles, y el
 * selector no los entrega. Sin dimensiones conocidas (0) no se acusa a la foto de nada.
 */
export function isUnclear(page: Pick<ScanPage, 'width' | 'height'>): boolean {
  const side = Math.min(page.width, page.height);
  return side > 0 && side < MIN_READABLE_SIDE;
}

const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'image/webp': 'webp',
};

function extensionFromPath(path: string | null | undefined): string | null {
  if (!path || path.startsWith('data:') || path.startsWith('blob:')) return null;
  const clean = path.split(/[?#]/u)[0] ?? '';
  const name = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  if (dot === -1) return null;
  const extension = name.slice(dot + 1).toLowerCase();
  if (extension === 'jpeg') return 'jpg';
  return extension === 'heif' ? 'heic' : extension;
}

/**
 * Extensión real de la foto. Nunca se etiqueta como JPEG algo que no lo es: la API deriva de
 * ella el tipo de contenido, y una foto con formato no admitido debe rechazarse con su motivo.
 */
export function photoExtension(asset: {
  mimeType?: string | null;
  fileName?: string | null;
  uri: string;
}): string {
  const byMime = asset.mimeType ? EXTENSION_BY_MIME[asset.mimeType.toLowerCase()] : undefined;
  return byMime ?? extensionFromPath(asset.fileName) ?? extensionFromPath(asset.uri) ?? 'jpg';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Nombre legible y único: la cola descarta los archivos repetidos por nombre y tamaño. */
export function scanFileName(
  base: string,
  capturedAt: number,
  position: number,
  extension: string,
): string {
  const d = new Date(capturedAt);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  return `${base} ${day} ${time} p${position}.${extension}`;
}

/** Convierte las páginas en archivos listos para `fileFromPicker`, en el orden de la lista. */
export function scanUploadAssets(
  pages: readonly ScanPage[],
  base: string,
): {
  name: string;
  size: number;
  uri: string;
  mimeType?: string;
  file?: Blob;
}[] {
  return pages.map((page, i) => ({
    name: scanFileName(base, page.capturedAt, i + 1, page.extension),
    size: page.sizeBytes,
    uri: page.uri,
    ...(page.mimeType ? { mimeType: page.mimeType } : {}),
    ...(page.webFile ? { file: page.webFile } : {}),
  }));
}
