/** 42 → "0:42"; 75 → "1:15". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 0.654 → "65 %" (formato es-PE con espacio antes del signo). */
export function formatPercent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)} %`;
}

const LOCALES = { es: 'es-PE', en: 'en-US' } as const;

/** Configuración regional para las fechas, según el idioma de la app. */
export function localeFor(language: 'es' | 'en'): string {
  return LOCALES[language];
}

/** ¿La fecha ISO cae hoy (en la hora del dispositivo)? Una fecha inválida no es hoy. */
export function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** 1536 → "1.5 KB"; 12 582 912 → "12 MB" (unidades de 1024, una cifra decimal como máximo). */
export function formatBytes(bytes: number, language: 'es' | 'en' = 'es'): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(LOCALES[language], {
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
  return `${number} ${units[unit] ?? 'B'}`;
}

/** Fecha ISO → "7/11/2026" (o "11/7/2026" en inglés). Una fecha inválida se muestra tal cual. */
export function formatDate(iso: string, language: 'es' | 'en' = 'es'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(LOCALES[language]);
}

/** Fecha y hora ISO → "7/11/2026, 14:05" (para la auditoría). */
export function formatDateTime(iso: string, language: 'es' | 'en' = 'es'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(LOCALES[language], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 1234 → "1234" / "1,234" según el idioma. */
export function formatCount(value: number, language: 'es' | 'en' = 'es'): string {
  return new Intl.NumberFormat(LOCALES[language]).format(value);
}

/**
 * Texto traducido de un código conocido (acción de auditoría, proveedor); si no se conoce, el
 * código tal cual. Solo claves propias: "constructor" o "toString" no se toman del prototipo.
 */
export function labelFor(labels: Readonly<Record<string, string>>, code: string): string {
  return Object.hasOwn(labels, code) ? (labels[code] ?? code) : code;
}
