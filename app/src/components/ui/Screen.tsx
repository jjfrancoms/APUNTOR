import { useRef, type ComponentRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { layout, space, useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  /** Contenido fijo al pie (botones principales). */
  footer?: ReactNode;
  /** Barra superior fija (no se desplaza). */
  header?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** En escritorio, usa un ancho mayor (pantallas con varias columnas, como Inicio). */
  wide?: boolean;
  /** Acceso y registro: una columna angosta. A 800 px, un campo de correo se ve vacío y perdido. */
  narrow?: boolean;
  /** Mantiene visible lo último (chat): baja al final cuando crece el contenido. */
  stickToBottom?: boolean;
}

/** Contenedor de pantalla: fondo del tema, márgenes seguros y ancho máximo en tablet/escritorio. */
export function Screen({
  children,
  footer,
  header,
  scroll = true,
  edges = ['top', 'left', 'right'],
  wide = false,
  narrow = false,
  stickToBottom = false,
}: ScreenProps) {
  const { c } = useTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const desktop = useWindowDimensions().width >= layout.breakpoints.desktop;
  // En escritorio: más aire a los lados y arriba, y un ancho máximo legible.
  const pad = desktop ? { paddingHorizontal: space.xxxl } : null;
  const column = desktop ? { paddingTop: space.xl } : null;
  const maxWidth = narrow ? 480 : desktop ? (wide ? 1120 : 800) : 720;
  // El desplazamiento ocupa todo el ancho (la barra queda en el borde de la ventana) y el
  // contenido se centra con un ancho máximo legible.
  const limit = { width: '100%' as const, maxWidth, alignSelf: 'center' as const };
  const body = <View style={[styles.content, limit]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: c.bg }]}>
      {/* En iOS el teclado tapa el pie (botones, campo del chat): se sube el contenido. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.column, column]}
      >
        {header ? <View style={[styles.header, pad, limit]}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.scroll, pad]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={
              stickToBottom ? () => scrollRef.current?.scrollToEnd({ animated: true }) : undefined
            }
          >
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, styles.flex, pad]}>{body}</View>
        )}
        {footer ? <View style={[styles.footer, pad, limit]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, width: '100%' },
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
