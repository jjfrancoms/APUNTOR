import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ease, layout, motion, radius, useTheme } from '@/theme';
import { Text } from './Text';
import { Tap } from './Tap';

const PAD = 4;

/**
 * Control segmentado (referencia: Segmented Control de halaska-studio): un pulgar desliza hasta
 * la opción activa. Con “reducir movimiento” el pulgar salta sin animar.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = Math.max(options.length, 1);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const itemWidth = Math.max(0, (width - PAD * 2) / count);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const target = index * itemWidth;
    if (reduced || width === 0) {
      x.setValue(target);
      return;
    }
    Animated.timing(x, {
      toValue: target,
      duration: motion.duration.base,
      easing: ease.out,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [index, itemWidth, reduced, width, x]);
  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segment, { backgroundColor: c.surfaceAlt }]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { width: itemWidth, backgroundColor: c.surface, borderColor: c.border },
            { transform: [{ translateX: x }] },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Tap
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={styles.item}
          >
            <Text variant="smallStrong" color={active ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: PAD },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  // El centrado es de la etiqueta dentro de su segmento.
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    minHeight: layout.minTouchTarget,
  },
});
