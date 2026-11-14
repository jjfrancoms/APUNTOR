import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Tap, type TapState } from './Tap';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'soft' | 'ghost';

/** `sm` = 44 px (acciones dentro de tarjetas), `md` = 52 px (por defecto), `lg` = 56 px. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  /** Con `loading` el botón queda inactivo y muestra un indicador junto a la etiqueta. */
  loading?: boolean;
  disabled?: boolean;
  /** Tamaño compacto (44 px) para acciones secundarias dentro de tarjetas. Igual a `size="sm"`. */
  compact?: boolean;
  size?: ButtonSize;
}

type FgToken = Exclude<keyof ColorTokens, 'accent' | 'accentSoft' | 'scrim'>;

const HEIGHT: Record<ButtonSize, number> = {
  sm: layout.minTouchTarget,
  md: layout.primaryButtonHeight,
  lg: 56,
};

/**
 * Botón (referencia: shadcn Button + ReUI). Variantes limpias, estado de carga que conserva la
 * etiqueta, foco de teclado con el anillo de marca (lo pinta `WebChrome`) y tres tamaños.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
  size,
}: ButtonProps) {
  const { c } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: FgToken; border: string }> = {
    primary: { bg: c.primary, fg: 'onPrimary', border: c.primary },
    secondary: { bg: c.surface, fg: 'text', border: c.border },
    danger: { bg: c.danger, fg: 'onPrimary', border: c.danger },
    soft: { bg: c.primarySoft, fg: 'primary', border: c.primarySoft },
    dangerOutline: { bg: c.surface, fg: 'danger', border: c.danger },
    ghost: { bg: 'transparent', fg: 'primary', border: 'transparent' },
  };
  const p = palette[variant];
  const resolved: ButtonSize = size ?? (compact === true ? 'sm' : 'md');
  const small = resolved === 'sm';
  const busy = loading === true;
  const inactive = disabled === true || busy;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed, hovered }: TapState) => [
        styles.base,
        {
          minHeight: HEIGHT[resolved],
          backgroundColor: p.bg,
          borderColor: p.border,
          // Cargando se ve activo (el botón sigue siendo el mismo); solo "disabled" se apaga.
          opacity: disabled === true ? 0.5 : pressed ? 0.85 : hovered === true ? 0.92 : 1,
          paddingHorizontal: small ? space.md : space.lg,
        },
      ]}
    >
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator size="small" color={c[p.fg]} />
        ) : icon ? (
          <Icon name={icon} size={16} color={p.fg} />
        ) : null}
        <Text variant={small ? 'smallStrong' : 'bodyStrong'} color={p.fg}>
          {label}
        </Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  // El centrado es solo del contenido del botón (ícono + etiqueta), no de un bloque de texto.
  base: {
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
