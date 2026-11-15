import { StyleSheet } from 'react-native';
import { layout, motion, radius, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Tap, type TapState } from './Tap';

/**
 * Botón de solo ícono (referencia: ReUI icon-only): cuadrado redondeado de 44 px como mínimo,
 * con fondo al pasar el puntero y al presionar. `label` es obligatorio para lectores de pantalla.
 * `plain` quita el fondo y el borde en reposo (cerrar una hoja, limpiar un campo, volver) y
 * conserva el área táctil completa.
 */
export function IconButton({
  icon,
  label,
  onPress,
  plain = false,
  edge,
  selected = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  plain?: boolean;
  /**
   * Con `plain`, hacia qué borde se corre el área táctil para alinear el ícono (no el área) con el
   * contenido: 'end' (por defecto, cerrar) o 'start' (volver).
   */
  edge?: 'start' | 'end' | 'none';
  /** Resalta el botón como activo (p. ej. un filtro abierto). */
  selected?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const side = edge ?? 'end';
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      hitSlop={4}
      pressScale={motion.pressScale}
      onPress={onPress}
      style={({ pressed, hovered }: TapState) => [
        styles.base,
        plain && side === 'end' && styles.plainEnd,
        plain && side === 'start' && styles.plainStart,
        {
          backgroundColor: selected
            ? c.primarySoft
            : pressed || hovered === true
              ? c.surfaceAlt
              : plain
                ? 'transparent'
                : c.surface,
          borderColor: plain ? 'transparent' : selected ? c.primary : c.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Icon name={icon} size={18} color={selected ? 'primary' : plain ? 'textMuted' : 'text'} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  // El margen alinea el ícono, no el área táctil, con el borde del contenido.
  plainEnd: { marginRight: -space.md },
  plainStart: { marginLeft: -space.md },
  base: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
