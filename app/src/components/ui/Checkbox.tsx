import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ease, layout, motion, radius, space, useTheme, webTransition } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { Tap, type TapState } from './Tap';

/**
 * Casilla (referencia: HeroUI Checkbox): marcada, indeterminada, inválida y bloqueada, con
 * etiqueta y descripción opcional. `children` es el texto (o contenido) de la etiqueta; si no se
 * pasa, se usa `label`. El ícono de marca distingue el estado sin depender del color.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  children,
  description,
  indeterminate = false,
  invalid = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children?: ReactNode;
  description?: string;
  /** Estado mixto (p. ej. “seleccionar todo” con algunos marcados): se muestra un guion. */
  indeterminate?: boolean;
  /** Marca el borde en rojo cuando falta aceptar algo obligatorio. */
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const on = checked || indeterminate;
  const reduced = useReducedMotion();
  // Marca: aparece con un fundido y un leve crecimiento (sin rebote); con «reducir movimiento», al instante.
  const mark = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      mark.setValue(on ? 1 : 0);
      return;
    }
    Animated.timing(mark, {
      toValue: on ? 1 : 0,
      duration: motion.duration.fast,
      easing: ease.out,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [on, reduced, mark]);
  const markScale = mark.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  return (
    <Tap
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed, hovered }: TapState) => [
        styles.row,
        { opacity: disabled ? 0.5 : 1 },
        (pressed || hovered === true) && !disabled && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.box,
          webTransition(reduced, ['background-color', 'border-color'], 'fast'),
          {
            borderColor: invalid ? c.danger : on ? c.primary : c.textMuted,
            backgroundColor: on ? c.primary : c.surface,
          },
        ]}
      >
        <Animated.View style={{ opacity: mark, transform: [{ scale: markScale }] }}>
          <Icon name={indeterminate ? 'minus' : 'check'} size={14} color="onPrimary" />
        </Animated.View>
      </View>
      <View style={styles.label}>
        {children ?? <Text variant="body">{label}</Text>}
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  // Alineado arriba: con etiqueta de varias líneas, la casilla queda junto a la primera.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    minHeight: layout.minTouchTarget,
    paddingVertical: space.sm,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm - 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  label: { flex: 1, gap: 2 },
});
