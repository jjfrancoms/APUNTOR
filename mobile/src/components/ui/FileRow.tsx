import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { Text } from './Text';

/** Fila de archivo: etiqueta del formato, nombre, detalle y control a la derecha. */
export function FileRow({
  ext,
  name,
  detail,
  detailTone = 'textMuted',
  trailing,
  children,
  tone = 'default',
}: {
  ext: string;
  name: string;
  detail: string;
  detailTone?: 'textMuted' | 'danger' | 'primary';
  trailing?: ReactNode;
  children?: ReactNode;
  tone?: 'default' | 'danger' | 'warning';
}) {
  const { c } = useTheme();
  const border = tone === 'danger' ? c.danger : tone === 'warning' ? c.accent : c.border;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: border }]}>
      <View style={styles.row}>
        <View style={[styles.ext, { backgroundColor: c.surfaceAlt }]}>
          <Text variant="overline" color="textMuted">
            {ext}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="smallStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color={detailTone}>
            {detail}
          </Text>
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ext: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // minWidth 0: el nombre se ajusta en vez de empujar o aplastarse contra el control derecho.
  flex: { flex: 1, minWidth: 0, gap: 2 },
  trailing: { flexShrink: 0, maxWidth: '45%' },
});
