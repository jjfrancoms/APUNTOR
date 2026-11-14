import { Pressable, StyleSheet, type PressableProps } from 'react-native';

/** Estado que `Pressable` entrega a `style`; en web también trae `hovered` (puntero encima). */
export interface TapState {
  pressed: boolean;
  hovered?: boolean;
  focused?: boolean;
}

/**
 * Pressable con respuesta al toque: baja la opacidad mientras se presiona (sin mover el
 * diseño). Úsalo en lugar de `Pressable` para que todo lo tocable dé la misma señal.
 */
export function Tap({ style, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && styles.pressed,
      ]}
    />
  );
}

const styles = StyleSheet.create({ pressed: { opacity: 0.7 } });
