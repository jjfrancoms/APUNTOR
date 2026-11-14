import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { radius, space, useTheme } from '@/theme';

export type CardTone = 'default' | 'primary' | 'external' | 'accent' | 'danger';

/**
 * Tarjeta (referencia: ReUI Card, sin adornos): superficie plana con borde fino y radio moderado. Los `children` son el contenido;
 * `header` y `footer` son ranuras opcionales separadas del contenido por una línea fina.
 */
export function Card({
  tone = 'default',
  style,
  header,
  footer,
  children,
  ...rest
}: ViewProps & { tone?: CardTone; header?: ReactNode; footer?: ReactNode }) {
  const { c } = useTheme();
  const tones = {
    default: { bg: c.surface, border: c.border },
    primary: { bg: c.primarySoft, border: c.primarySoft },
    external: { bg: c.surface, border: c.external },
    accent: { bg: c.accentSoft, border: c.accentSoft },
    danger: { bg: c.dangerSoft, border: c.danger },
  } as const;
  const t = tones[tone];
  const divider = { borderColor: tone === 'default' ? c.border : t.border };
  return (
    <View {...rest} style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      {header ? <View style={[styles.header, divider]}>{header}</View> : null}
      {header || footer ? <View style={styles.content}>{children}</View> : children}
      {footer ? <View style={[styles.footer, divider]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  content: { gap: space.sm },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: space.md },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
});
