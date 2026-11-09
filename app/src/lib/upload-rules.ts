import type { ErrorCode } from '@/i18n/es';

export const MAX_UPLOAD_MB = 50;

/**
 * Formatos que el servidor acepta, con su tipo MIME (igual que `UPLOAD_CONTENT_TYPES` de la API).
 * Los formatos antiguos de Office (.doc, .ppt) no se leen: se rechazan con UP_FORMAT y el mensaje
 * sugiere guardarlos como .docx o .pptx.
 */
export const ACCEPTED_CONTENT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
} as const;

export type AcceptedExtension = keyof typeof ACCEPTED_CONTENT_TYPES;
export const ACCEPTED_EXTENSIONS = Object.keys(ACCEPTED_CONTENT_TYPES) as AcceptedExtension[];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

/** Etiqueta corta del formato para el ícono de archivo ("PDF", "PPT", "IMG"…). */
export function extLabel(name: string): string {
  const ext = extensionOf(name);
  if (['jpg', 'jpeg', 'png', 'heic'].includes(ext)) return 'IMG';
  if (ext === 'pptx') return 'PPT';
  if (ext === 'docx') return 'DOC';
  return ext.toUpperCase().slice(0, 4) || 'ARCH';
}

export function isImage(name: string): boolean {
  return extLabel(name) === 'IMG';
}

/**
 * Valida un archivo antes de subirlo. Devuelve el código de error de la
 * especificación (UP_FORMAT, UP_SIZE, UP_QUOTA) o null si es válido. El idioma no se comprueba
 * aquí: no hay detector real todavía (la pantalla 41 solo se ve en la vista previa).
 */
export function validateUpload(
  file: { name: string; sizeMb: number },
  usedMb: number,
  quotaMb: number,
): ErrorCode | null {
  const ext = extensionOf(file.name);
  // El tamaño va primero: así un video de 212 MB se explica como 'Supera el límite' (pantalla 18).
  if (file.sizeMb > MAX_UPLOAD_MB) return 'UP_SIZE';
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) return 'UP_FORMAT';
  if (usedMb + file.sizeMb > quotaMb) return 'UP_QUOTA';
  return null;
}
