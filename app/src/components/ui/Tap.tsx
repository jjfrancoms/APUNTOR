import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { webTransition } from '@/theme';

/** Estado que `Pressable` entrega a `style`; en web también trae `hovered` (puntero encima). */
export interface TapState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

export interface TapProps extends PressableProps {
  /**
   * Escala mientras se presiona (p. ej. `motion.pressScale`). Con un valor menor que 1 la escala
   * reemplaza a la opacidad como señal de presión. Por defecto no escala.
   */
  pressScale?: number;
}

/** Propiedades que cambian con el puntero o el toque; en web se animan con los tokens. */
const ANIMATED = ['transform', 'opacity', 'background-color', 'border-color'] as const;

/**
 * Pressable con respuesta al toque: baja la opacidad mientras se presiona (sin mover el
 * diseño) o, con `pressScale`, se encoge un poco. En web los cambios de estado (puntero encima,
 * presionado) se suavizan; con «reducir movimiento» todo es inmediato y sin escala. Úsalo en
 * lugar de `Pressable` para que todo lo tocable dé la misma señal.
 */
export function Tap({ style, pressScale = 1, ...props }: TapProps) {
  const reduced = useReducedMotion();
  const scales = pressScale < 1 && !reduced;
  const transition = webTransition(reduced, ANIMATED, 'fast');
  return (
    <Pressable
      {...props}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        transition,
        state.pressed && pressScale >= 1 && styles.pressed,
        state.pressed && scales && { transform: [{ scale: pressScale }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({ pressed: { opacity: 0.7 } });
