import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Hoja inferior modal (pantallas 27, 35, 36). Con `title` muestra encabezado y botón cerrar. */
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
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
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
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
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
