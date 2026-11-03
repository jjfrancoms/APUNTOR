import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Contenido fijo al pie (botones principales). */
  footer?: ReactNode;
  /** Barra superior fija (no se desplaza). */
  header?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}

/** Contenedor de pantalla: fondo del tema, márgenes seguros y ancho máximo en tablet/escritorio. */
export function Screen({
  children,
  footer,
  header,
  scroll = true,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const { c } = useTheme();
  const body = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={styles.column}>
        {header ? <View style={styles.header}>{header}</View> : null}
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, styles.flex]}>{body}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.sm },
  scroll: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  flex: { flex: 1 },
  content: { gap: space.lg, flexGrow: 1 },
  footer: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
});
