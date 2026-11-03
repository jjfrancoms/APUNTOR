import type { ErrorCode } from '@/i18n/es';
import { normalize } from './text-search';

export const MAX_UPLOAD_MB = 50;
export const ACCEPTED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'txt',
  'md',
  'jpg',
  'jpeg',
  'png',
  'heic',
] as const;

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

/** Etiqueta corta del formato para el ícono de archivo ("PDF", "PPT", "IMG"…). */
export function extLabel(name: string): string {
  const ext = extensionOf(name);
  if (['jpg', 'jpeg', 'png', 'heic'].includes(ext)) return 'IMG';
  if (ext === 'pptx' || ext === 'ppt') return 'PPT';
  if (ext === 'docx' || ext === 'doc') return 'DOC';
  return ext.toUpperCase().slice(0, 4) || 'ARCH';
}

export function isImage(name: string): boolean {
  return extLabel(name) === 'IMG';
}

/**
 * Valida un archivo antes de subirlo. Devuelve el código de error de la
 * especificación (UP_FORMAT, UP_SIZE, UP_QUOTA, UP_LANGUAGE) o null si es válido.
 * El idioma se simula por el nombre (p. ej. "…chino…") hasta tener el detector real.
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
  if (/chino|chinese|中文|zh[_-]/u.test(normalize(file.name))) return 'UP_LANGUAGE';
  return null;
}

/** Sugiere un curso comparando el nombre del archivo con los títulos de los cursos. */
export function suggestCourse<T extends { id: string; title: string; keywords: readonly string[] }>(
  fileName: string,
  courses: readonly T[],
): T | null {
  const name = normalize(fileName);
  for (const course of courses) {
    const words = [normalize(course.title), ...course.keywords.map(normalize)];
    if (words.some((w) => w.length > 2 && name.includes(w))) return course;
  }
  return null;
}
