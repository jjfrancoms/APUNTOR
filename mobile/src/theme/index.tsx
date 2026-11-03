import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  colors,
  layout,
  navigationLayoutFor,
  type ColorMode,
  type ColorTokens,
} from '../../../src/design/tokens';

export { layout, navigationLayoutFor };
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
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  subheading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
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

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
