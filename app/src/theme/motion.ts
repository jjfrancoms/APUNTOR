import { Easing, Platform, type ViewStyle } from 'react-native';
import { motion } from './tokens';

type Duration = keyof typeof motion.duration;
type Curve = keyof typeof motion.easing;

const [ox1, oy1, ox2, oy2] = motion.easing.out;
const [ix1, iy1, ix2, iy2] = motion.easing.inOut;

/** Curvas de `Animated` (RN) a partir de los tokens. */
export const ease = {
  out: Easing.bezier(ox1, oy1, ox2, oy2),
  inOut: Easing.bezier(ix1, iy1, ix2, iy2),
} as const;

/** La misma curva como texto CSS (solo web). */
export function cssEasing(curve: Curve): string {
  return `cubic-bezier(${motion.easing[curve].join(', ')})`;
}

/**
 * Transición CSS para web (react-native-web la pasa tal cual al DOM). React Native no tipa
 * `transition*`, por eso el estilo se arma aparte. En nativo, o con «reducir movimiento»,
 * devuelve un estilo vacío: el cambio es inmediato.
 */
export function webTransition(
  reduced: boolean,
  properties: readonly string[],
  duration: Duration = 'fast',
  curve: Curve = 'out',
): ViewStyle {
  if (reduced || Platform.OS !== 'web') return {};
  const style: Record<string, string> = {
    transitionProperty: properties.join(', '),
    transitionDuration: `${motion.duration[duration]}ms`,
    transitionTimingFunction: cssEasing(curve),
  };
  return style as unknown as ViewStyle;
}
