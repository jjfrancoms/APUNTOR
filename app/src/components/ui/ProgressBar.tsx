import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

export type ProgressTone = 'primary' | 'accent' | 'danger';

/**
 * Barra de progreso (referencia: HeroUI Progress Bar). `label` es el nombre accesible. Con
 * `showLabel` se ve sobre la barra, a la izquierda, y con `showValue` el porcentaje a la derecha.
 * `indeterminate` muestra un tramo que recorre la barra (sin valor); con “reducir movimiento”
 * queda un tramo fijo. `valueText` reemplaza al porcentaje (p. ej. “3 de 5 páginas”).
 */
export function ProgressBar({
  value,
  tone = 'primary',
  label,
  showLabel = false,
  showValue = false,
  valueText,
  indeterminate = false,
}: {
  value: number;
  tone?: ProgressTone;
  label: string;
  showLabel?: boolean;
  showValue?: boolean;
  valueText?: string;
  indeterminate?: boolean;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = { primary: c.primary, accent: c.accent, danger: c.danger }[tone];
  const [width, setWidth] = useState(0);
  const run = useRef(new Animated.Value(0)).current;
  const sweeping = indeterminate && !reduced;
  useEffect(() => {
    if (!sweeping) return;
    run.setValue(0);
    const loop = Animated.loop(
      Animated.timing(run, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweeping, run]);
  const segment = Math.max(width * 0.35, 24);
  const left = run.interpolate({ inputRange: [0, 1], outputRange: [-segment, width] });
  const showText = showLabel || showValue || valueText !== undefined;
  return (
    <View style={styles.wrap}>
      {showText ? (
        <View style={styles.head}>
          {showLabel ? (
            <Text variant="label" style={styles.flex}>
              {label}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          {showValue || valueText !== undefined ? (
            <Text variant="caption" color="textMuted">
              {valueText ?? (indeterminate ? '' : `${pct} %`)}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={
          indeterminate ? { text: valueText } : { min: 0, max: 100, now: pct, text: valueText }
        }
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: c.surfaceAlt }]}
      >
        {indeterminate ? (
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: fill, width: segment },
              sweeping ? { transform: [{ translateX: left }] } : { width: '40%' },
            ]}
          />
        ) : (
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fill }]} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  flex: { flex: 1 },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
