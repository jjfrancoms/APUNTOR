import { Text as RNText, type TextProps } from 'react-native';
import { typeScale, useTheme, type ColorTokens, type TypeVariant } from '@/theme';

type TextColor = Exclude<keyof ColorTokens, 'accent' | 'accentSoft'>;

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  /** El ámbar (`accent`) no se admite como color de texto por regla de marca. */
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  return (
    <RNText {...rest} style={[typeScale[variant], { color: c[color], textAlign: align }, style]} />
  );
}
