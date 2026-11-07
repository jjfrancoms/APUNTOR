import { StyleSheet, View } from 'react-native';
import { Mascot, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Marcador para pantallas del mapa aún no diseñadas o pendientes de la siguiente entrega. */
export function ComingSoon({ title, withBack = false }: { title: string; withBack?: boolean }) {
  const s = useStrings();
  return (
    <Screen header={withBack ? <TopBar title={title} /> : undefined}>
      {!withBack ? (
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.center}>
        <Mascot size={96} mood="curious" />
        <Text variant="small" color="textMuted" align="center">
          {s.common.comingSoon}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
