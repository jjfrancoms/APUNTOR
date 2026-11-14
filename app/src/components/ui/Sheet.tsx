import { useRef, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStrings } from '@/i18n/es';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { layout, radius, space, useTheme } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { Tap } from './Tap';

/** Cuánto hay que arrastrar el asa hacia abajo (px) para cerrar la hoja. */
const DISMISS_DRAG = 80;

/**
 * Hoja modal (pantallas 27, 35, 36; referencia: Bottom Sheet de f0rextasy). En móvil sube desde
 * abajo con asa que se puede arrastrar hacia abajo para cerrar; desde tablet (≥ 600 px) se
 * muestra como diálogo centrado. Tocar el velo o pulsar Escape (web) la cierra. Con `title`
 * muestra encabezado y botón cerrar.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const { c } = useTheme();
  const s = useStrings();
  const insets = useSafeAreaInsets();
  const dialog = useWindowDimensions().width >= layout.breakpoints.tablet;
  // Con “reducir movimiento”, la hoja aparece con un fundido en lugar de subir.
  const reducedMotion = useReducedMotion();
  // Arrastre del asa: la hoja sigue al dedo hacia abajo; al soltar pasado el umbral, se cierra.
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DISMISS_DRAG) {
          drag.setValue(0);
          onCloseRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => drag.setValue(0),
    }),
  ).current;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={dialog || reducedMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View
        style={[styles.backdrop, { backgroundColor: c.scrim }, dialog && styles.backdropCenter]}
      >
        <Tap
          accessibilityRole="button"
          accessibilityLabel={s.common.close}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              paddingBottom: space.xxl + insets.bottom,
            },
            dialog && styles.dialog,
            !dialog && { transform: [{ translateY: drag }] },
          ]}
          accessibilityViewIsModal
        >
          {dialog ? null : (
            <View style={styles.handleArea} {...pan.panHandlers}>
              <View style={[styles.handle, { backgroundColor: c.textMuted }]} />
            </View>
          )}
          {title ? (
            <View style={styles.head}>
              <Text variant="heading" style={styles.flex} accessibilityRole="header">
                {title}
              </Text>
              <IconButton plain icon="x" label={s.common.close} onPress={onClose} />
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: space.xxl,
    gap: space.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  backdropCenter: { justifyContent: 'center', padding: space.xxl },
  dialog: {
    borderRadius: radius.md,
    borderBottomWidth: 1,
    maxWidth: 480,
    paddingBottom: space.xxl,
    maxHeight: '90%',
  },
  // Área de agarre de 44 px de alto; el asa visible es solo la barra de 40 × 4.
  handleArea: {
    height: layout.minTouchTarget,
    marginTop: -space.md - space.xs,
    marginBottom: -space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, opacity: 0.5 },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
