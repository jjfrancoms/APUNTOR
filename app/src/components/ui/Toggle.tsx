import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ease, layout, motion, space, useTheme, webTransition } from '@/theme';
import { Tap } from './Tap';
import { Text } from './Text';

const TRACK_W = 48;
const TRACK_H = 28;
const THUMB = 20;
const BORDER = 1.5;
const PAD = (TRACK_H - BORDER * 2 - THUMB) / 2;

/**
 * Interruptor (referencia: HeroUI Switch): pista y pulgar propios, con área táctil de 44 px.
 * `label` es el nombre accesible. Con `description` (y `title`, que por defecto es `label`) se
 * muestra como fila: texto a la izquierda y el interruptor a la derecha.
 */
export function Toggle({
  value,
  onChange,
  label,
  description,
  title,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  title?: string;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      x.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(x, {
      toValue: value ? 1 : 0,
      duration: motion.duration.base,
      easing: ease.out,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [value, reduced, x]);
  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_W - BORDER * 2 - THUMB - PAD * 2],
  });
  const colorFade = webTransition(reduced, ['background-color', 'border-color'], 'base');
  const control = (
    <View style={styles.hit}>
      <View
        style={[
          styles.track,
          colorFade,
          // Apagado: borde y pulgar atenuados (contraste ≥ 3:1 con el fondo); encendido: marca.
          {
            backgroundColor: value ? c.primary : c.surfaceAlt,
            borderColor: value ? c.primary : c.textMuted,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: value ? c.surface : c.textMuted, transform: [{ translateX }] },
            colorFade,
          ]}
        />
      </View>
    </View>
  );
  const row = description !== undefined || title !== undefined;
  return (
    <Tap
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[row ? styles.row : styles.solo, { opacity: disabled ? 0.5 : 1 }]}
    >
      {row ? (
        <View style={styles.text}>
          <Text variant="bodyStrong">{title ?? label}</Text>
          {description ? (
            <Text variant="caption" color="textMuted">
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}
      {control}
    </Tap>
  );
}

const styles = StyleSheet.create({
  solo: { alignSelf: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: layout.minTouchTarget,
  },
  text: { flex: 1, gap: 2 },
  hit: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: BORDER,
    padding: PAD,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
});
