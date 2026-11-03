/**
 * Tokens de color de APUNTOR (fuente: docs/producto/mvp-ux.md §7).
 * Agnóstico de plataforma: lo puede importar la app Expo/React Native.
 *
 * Significado: primary (verde) = material propio; external (violeta) = contexto
 * externo; accent (ámbar) = avisos y mascota, NUNCA texto; danger = errores y
 * acciones destructivas.
 */

export type ColorMode = 'light' | 'dark';

export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  external: string;
  externalSoft: string;
  danger: string;
  dangerSoft: string;
  /** Solo para fondos, íconos y mascota. Prohibido como color de texto. */
  accent: string;
  accentSoft: string;
  /** Velo detrás de hojas y diálogos (con transparencia). Nunca texto. */
  scrim: string;
}

export const colors: Readonly<Record<ColorMode, Readonly<ColorTokens>>> = {
  light: {
    bg: '#FAF9F6',
    surface: '#FFFFFF',
    surfaceAlt: '#F2F0EB',
    border: '#E7E4DD',
    text: '#1C1C1E',
    textMuted: '#6B6B72',
    primary: '#1D7568',
    onPrimary: '#FFFFFF',
    primarySoft: '#E3F1EE',
    external: '#5B4FC7',
    externalSoft: '#ECEAFB',
    danger: '#C0392B',
    dangerSoft: '#FBEAE8',
    accent: '#F2A93B',
    accentSoft: '#FDF1DC',
    scrim: '#1C1C1E66',
  },
  dark: {
    bg: '#121413',
    surface: '#1C1F1E',
    surfaceAlt: '#262A29',
    border: '#363B3A',
    text: '#F2F2F0',
    textMuted: '#A9AEAC',
    primary: '#4DB6A6',
    onPrimary: '#0B1F1C',
    primarySoft: '#1B3A36',
    external: '#B3A8F7',
    externalSoft: '#2A2650',
    danger: '#F28B80',
    dangerSoft: '#3D1F1C',
    accent: '#F2A93B',
    accentSoft: '#3A2E17',
    scrim: '#000000A3',
  },
};

/**
 * Colores de la ilustración de la mascota. Son parte del dibujo (no cambian con el tema),
 * por eso no son tokens de interfaz y no se usan fuera de `Mascot`.
 */
export const mascotPalette = {
  fur: '#EAD9BD',
  furLight: '#F6ECDC',
  inner: '#F2B8B5',
  nose: '#5B3A2E',
  ink: '#2B2B2E',
  shine: '#FFFFFF',
  tear: '#8FB8E8',
  scarf: '#1D7568',
  sparkle: '#F2A93B',
  sleep: '#B5ADA2',
} as const;

export const layout = {
  /** Área táctil mínima (px). */
  minTouchTarget: 44,
  /** Alto de botones principales (px). */
  primaryButtonHeight: 52,
  breakpoints: {
    /** < 600 px: barra inferior. */
    tablet: 600,
    /** ≥ 1024 px: barra lateral ancha. */
    desktop: 1024,
  },
  sidebarWidth: { tablet: 88, desktop: 280 },
} as const;

export type NavigationLayout = 'bottom-bar' | 'rail' | 'sidebar';

/** Tablet entre 600 y 1023 px: barra lateral de 88 px; ≥ 1024 px: 280 px. */
export function navigationLayoutFor(widthPx: number): NavigationLayout {
  if (widthPx >= layout.breakpoints.desktop) return 'sidebar';
  if (widthPx >= layout.breakpoints.tablet) return 'rail';
  return 'bottom-bar';
}

export const typography = {
  fontFamily: 'Plus Jakarta Sans',
} as const;

// --- Contraste WCAG 2.x --------------------------------------------------------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/iu.exec(hex);
  if (!match?.[1]) throw new Error(`Color inválido: ${hex}`);
  const n = parseInt(match[1], 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const [hi, lo] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Pares texto/fondo que la interfaz usa; todos deben cumplir AA (≥ 4,5:1). */
export const TEXT_PAIRS: readonly (readonly [keyof ColorTokens, keyof ColorTokens])[] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['primary', 'primarySoft'],
  ['onPrimary', 'primary'],
  ['external', 'surface'],
  ['external', 'externalSoft'],
  ['danger', 'surface'],
  ['danger', 'dangerSoft'],
];
