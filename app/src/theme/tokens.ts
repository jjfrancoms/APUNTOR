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

/**
 * Paleta de las pantallas de acceso (inicio de sesión, registro, recuperación, privacidad…).
 * Es fija: se ve igual con el tema claro y con el oscuro del sistema. Teal profundo, "ni tan claro
 * ni tan oscuro". Solo la usan `AuthTheme` y los componentes de acceso; el resto de la app sigue
 * con `colors`. Los valores se documentan en DESIGN.md (sección «Pantallas de acceso») y un test
 * comprueba que ambos coincidan.
 */
export const auth = {
  /** Fondo base de la pantalla. */
  bg: '#0D2427',
  /** Fondo más profundo, para las esquinas y las curvas. */
  bgDeep: '#08191B',
  /** Superficie de la tarjeta del formulario. */
  card: '#0F292C',
  /** Relleno de los campos y de los botones secundarios. */
  field: '#0A1D20',
  /** Borde fino de campos, botones secundarios y líneas divisorias. */
  fieldBorder: '#2F5254',
  /** Borde brillante de la tarjeta (teal con transparencia). */
  cardBorder: '#4DB6A68C',
  /** Texto principal. */
  text: '#F2F7F6',
  /** Texto secundario (gris verdoso). */
  textMuted: '#9DB8B5',
  /** Acento: enlaces, palabra destacada, anillo de foco, íconos de marca. */
  accent: '#3FD0B5',
  /** Halo del anillo de foco de los campos (acento con transparencia). */
  accentRing: '#3FD0B538',
  /** Extremo claro (arriba) del degradado del botón principal. */
  accentTop: '#5BE6CC',
  /** Extremo oscuro (abajo) del degradado del botón principal. */
  accentBottom: '#2FB39D',
  /** Texto sobre el botón principal. */
  onAccent: '#04211D',
  /** Resplandor del borde de la tarjeta (teal con transparencia). */
  cardGlow: '#4DB6A640',
  /** Brillo grande de fondo (verde de marca). */
  glow: '#1D7568',
  /** Brillo suave y trazo de las curvas de fondo (teal claro). */
  glowSoft: '#4DB6A6',
  /** Errores sobre fondo oscuro. */
  danger: '#F28B80',
  dangerSoft: '#3D1F1C',
} as const;

/**
 * Colores de la marca «G» de Google. Excepción documentada: es la marca de un tercero y sus
 * pautas exigen estos colores; solo la usa `GoogleSignIn`. No son tokens de interfaz.
 */
export const googleMark = {
  yellow: '#FFC107',
  red: '#FF3D00',
  green: '#4CAF50',
  blue: '#1976D2',
} as const;

export type AuthTokens = typeof auth;

/** La paleta de acceso con la forma de `ColorTokens`: así Text, TextField, Button… la usan sin cambios. */
export const authColors: Readonly<ColorTokens> = {
  bg: auth.bg,
  surface: auth.field,
  surfaceAlt: auth.card,
  border: auth.fieldBorder,
  text: auth.text,
  textMuted: auth.textMuted,
  primary: auth.accent,
  onPrimary: auth.onAccent,
  primarySoft: auth.accentRing,
  external: colors.dark.external,
  externalSoft: colors.dark.externalSoft,
  danger: auth.danger,
  dangerSoft: auth.dangerSoft,
  accent: colors.dark.accent,
  accentSoft: colors.dark.accentSoft,
  scrim: colors.dark.scrim,
};

/** Pares texto/fondo de las pantallas de acceso; todos deben cumplir AA (≥ 4,5:1). */
export const AUTH_TEXT_PAIRS: readonly (readonly [string, string])[] = [
  [auth.text, auth.bg],
  [auth.text, auth.card],
  [auth.text, auth.field],
  [auth.textMuted, auth.bg],
  [auth.textMuted, auth.card],
  [auth.textMuted, auth.field],
  [auth.accent, auth.bg],
  [auth.accent, auth.card],
  [auth.accent, auth.field],
  [auth.onAccent, auth.accentTop],
  [auth.onAccent, auth.accentBottom],
  [auth.danger, auth.card],
  [auth.danger, auth.field],
];

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

/**
 * Movimiento: duraciones (ms) y curvas compartidas. Discreto y funcional: sin rebote, sin
 * sobreimpulso. Los valores se documentan en DESIGN.md (sección «Movimiento») y un test
 * comprueba que ambos coincidan.
 */
export const motion = {
  duration: {
    /** Respuesta al toque (escala, tinte al pasar el puntero). */
    fast: 120,
    /** Cambios de estado (interruptor, segmentado, foco, marca, aviso). */
    base: 180,
    /** Entrada de hojas y diálogos. */
    slow: 240,
    /** Revelado circular al cambiar de tema (solo web). */
    reveal: 400,
  },
  /** Curvas cúbicas [x1, y1, x2, y2]: `out` para entradas, `inOut` para cambios de estado. */
  easing: {
    out: [0.23, 1, 0.32, 1],
    inOut: [0.77, 0, 0.175, 1],
  },
  /** Escala al presionar un control. */
  pressScale: 0.97,
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
