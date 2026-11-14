import { Text as RNText, type TextProps } from 'react-native';
import { typeScale, useTheme, type ColorTokens, type TypeVariant } from '@/theme';

type TextColor = Exclude<keyof ColorTokens, 'accent' | 'accentSoft' | 'scrim'>;

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  /** El ámbar (`accent`) no se admite como color de texto por regla de marca. */
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color, align, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  // `muted` es la variante de texto secundario: por defecto va en el color atenuado.
  const tint = color ?? (variant === 'muted' ? 'textMuted' : 'text');
  return (
    <RNText
      // El overline solo se usa como encabezado de sección de una lista.
      accessibilityRole={variant === 'overline' ? 'header' : undefined}
      {...rest}
      style={[typeScale[variant], { color: c[tint], textAlign: align }, style]}
    />
  );
}
