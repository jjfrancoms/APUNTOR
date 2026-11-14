import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';
import {
  colors,
  layout,
  mascotPalette,
  navigationLayoutFor,
  type ColorMode,
  type ColorTokens,
} from './tokens';

export { layout, mascotPalette, navigationLayoutFor };
/** Paletas completas, para superficies que no cambian con el tema (p. ej. el visor de cámara). */
export { colors as palettes };
export type { ColorTokens };

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const typeScale = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  /** Frase de apoyo bajo un título: algo mayor que el cuerpo. */
  lead: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 26 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Texto secundario: mismo tamaño que `small`; `Text` le da por defecto el color atenuado. */
  muted: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Etiqueta de campo o de control: igual que `smallStrong`. */
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6 },
} as const;

export type TypeVariant = keyof typeof typeScale;

export interface Theme {
  mode: ColorMode;
  c: ColorTokens;
}

const ThemeContext = createContext<Theme>({ mode: 'light', c: colors.light });

export function ThemeProvider({ children, mode }: { children: ReactNode; mode?: ColorMode }) {
  const scheme = useColorScheme();
  const resolved: ColorMode = mode ?? (scheme === 'dark' ? 'dark' : 'light');
  const value = useMemo<Theme>(() => ({ mode: resolved, c: colors[resolved] }), [resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * `true` desde tablet (≥ `layout.breakpoints.tablet`, 600 px): los componentes que organizan
 * contenido pasan a su variante ancha (p. ej. la mascota junto al texto en `EmptyState`).
 */
export function useWide(): boolean {
  return useWindowDimensions().width >= layout.breakpoints.tablet;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
