import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * Hoja modal (pantallas 27, 35, 36). En móvil sube desde abajo; desde tablet (≥ 600 px) se
 * muestra como diálogo centrado. Con `title` muestra encabezado y botón cerrar.
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType={dialog ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, dialog && styles.backdropCenter]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.common.close}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, paddingBottom: space.xxl + insets.bottom },
            dialog && styles.dialog,
          ]}
          accessibilityViewIsModal
        >
          {dialog ? null : <View style={[styles.handle, { backgroundColor: c.border }]} />}
          {title ? (
            <View style={styles.head}>
              <Text variant="heading" style={styles.flex} accessibilityRole="header">
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={s.common.close}
                onPress={onClose}
                hitSlop={12}
              >
                <Icon name="x" color="textMuted" />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xxl,
    gap: space.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  backdropCenter: { justifyContent: 'center', padding: space.xxl },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 480,
    paddingBottom: space.xxl,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
