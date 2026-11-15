import { useId } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { layout, motion, radius, space, useTheme, type ColorTokens } from '@/theme';
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
  /** Marca a color a la izquierda (p. ej. la «G» de Google); sustituye a `icon`. */
  mark?: ReactNode;
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
  mark,
  loading,
  disabled,
  compact,
  size,
}: ButtonProps) {
  const { c, auth } = useTheme();
  // Degradado teal del botón principal: solo en las pantallas de acceso (excepción aprobada).
  const gradientId = `btn-${useId().replace(/[^a-zA-Z0-9]/gu, '')}`;
  const ghostTint = (v: ButtonVariant, active: boolean): string | undefined =>
    v === 'ghost' && active && disabled !== true ? c.primarySoft : undefined;
  const palette: Record<ButtonVariant, { bg: string; fg: FgToken; border: string }> = {
    primary: {
      bg: auth ? auth.accentBottom : c.primary,
      fg: 'onPrimary',
      border: auth ? auth.accentTop : c.primary,
    },
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
  const gradient = auth !== null && variant === 'primary' ? auth : null;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      pressScale={motion.pressScale}
      style={({ pressed, hovered }: TapState) => [
        styles.base,
        {
          minHeight: HEIGHT[resolved],
          // `ghost` es la acción sin caja (ícono y etiqueta, sin borde ni fondo en reposo): solo
          // al pasar el puntero o presionar aparece un tinte suave.
          backgroundColor: ghostTint(variant, pressed || hovered === true) ?? p.bg,
          borderColor: ghostTint(variant, pressed || hovered === true) ?? p.border,
          // Cargando se ve activo (el botón sigue siendo el mismo); solo "disabled" se apaga.
          opacity:
            disabled === true
              ? 0.5
              : variant === 'ghost'
                ? 1
                : pressed
                  ? 0.85
                  : hovered === true
                    ? 0.92
                    : 1,
          paddingHorizontal: small ? space.md : space.lg,
          overflow: gradient ? 'hidden' : 'visible',
        },
      ]}
    >
      {gradient ? (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" aria-hidden>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={gradient.accentTop} />
              <Stop offset="1" stopColor={gradient.accentBottom} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      ) : null}
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator size="small" color={c[p.fg]} />
        ) : mark ? (
          mark
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
