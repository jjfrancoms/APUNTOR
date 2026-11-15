import { StyleSheet, View } from 'react-native';
import { Mascot, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space, useWide } from '@/theme';

/** Marcador para pantallas del mapa aún no diseñadas o pendientes de la siguiente entrega. */
export function ComingSoon({ title, withBack = false }: { title: string; withBack?: boolean }) {
  const s = useStrings();
  const wide = useWide();
  return (
    <Screen header={withBack ? <TopBar title={title} /> : undefined}>
      {!withBack ? (
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {/* Illari pequeña junto al texto, alineado a la izquierda (sin pila centrada). */}
      <View style={[styles.row, wide && styles.rowWide]}>
        <Mascot size={wide ? 72 : 56} mood="curious" />
        <Text variant="body" color="textMuted" style={styles.text}>
          {s.common.comingSoon}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.xl },
  rowWide: { gap: space.xxl },
  text: { flexShrink: 1, maxWidth: 480 },
});
