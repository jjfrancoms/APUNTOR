import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandLogo, Mascot, Screen, Text, type MascotMood } from '@/components/ui';
import { space, useTheme, useWide } from '@/theme';

/**
 * Marco de las pantallas de acceso (inicio de sesión, registro, recuperación, privacidad…).
 * - Ancho (≥ 600 px): dos columnas. A la izquierda la marca (logo, título, frase de apoyo e
 *   Illari pequeña) y a la derecha el formulario, separados por una línea fina.
 * - Teléfono: una columna, todo alineado a la izquierda; logo pequeño arriba, título y formulario.
 *   Illari se omite (son pantallas de formulario).
 * El pie (botones fijos) va en la columna del formulario en ancho, para que no sea más ancho que
 * el contenido; en el teléfono queda fijo al pie de la pantalla.
 */
export function AuthLayout({
  title,
  subtitle,
  header,
  footer,
  mood,
  children,
}: {
  title: string;
  subtitle?: string;
  header?: ReactNode;
  footer?: ReactNode;
  /** Ánimo de Illari en la columna de marca (solo en pantalla ancha). Sin valor, no se muestra. */
  mood?: MascotMood;
  children?: ReactNode;
}) {
  const wide = useWide();
  const { c } = useTheme();
  const heading = (
    <View style={styles.heading}>
      <Text variant={wide ? 'display' : 'title'} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="lead" color="textMuted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
  if (!wide) {
    return (
      <Screen header={header} footer={footer}>
        <View style={styles.phone}>
          <BrandLogo variant="horizontal" size={24} />
          {heading}
          {children}
        </View>
      </Screen>
    );
  }
  return (
    <Screen wide header={header}>
      <View style={styles.columns}>
        <View style={styles.brand}>
          <BrandLogo variant="horizontal" size={32} />
          {heading}
          {mood ? <Mascot size={72} mood={mood} /> : null}
        </View>
        <View style={[styles.form, { borderLeftColor: c.border }]}>
          {children}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  phone: { gap: space.xl, paddingTop: space.md },
  heading: { gap: space.sm },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xxxl,
    paddingTop: space.xl,
  },
  brand: { flex: 1, minWidth: 0, gap: space.xl, alignItems: 'flex-start' },
  form: {
    flex: 1,
    minWidth: 0,
    maxWidth: 560,
    gap: space.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: space.xxxl,
  },
  footer: { gap: space.sm, paddingTop: space.sm },
});
