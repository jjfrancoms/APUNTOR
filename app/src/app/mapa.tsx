import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Icon, Screen, Text } from '@/components/ui';
import { allScreens, screenGroups } from '@/data/screens';
import { useStrings } from '@/i18n/es';
import { space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Índice de la vista previa: las 44 pantallas agrupadas como el mapa de navegación. */
export default function ScreenMap() {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View>
        <Text variant="display" accessibilityRole="header">
          {s.map.title}
        </Text>
        <Text variant="small" color="textMuted">
          {`${s.map.intro} (${allScreens.length})`}
        </Text>
      </View>
      {screenGroups.map((g) => (
        <View key={g.title} style={styles.group}>
          <Text variant="heading" accessibilityRole="header">
            {g.title}
          </Text>
          <Card style={styles.list}>
            {g.screens.map((scr, i) => (
              <Tap
                key={scr.n}
                accessibilityRole="link"
                accessibilityLabel={`${scr.n} ${scr.name}`}
                onPress={() => router.push(scr.href as never)}
                style={[
                  styles.row,
                  i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text variant="smallStrong" color="primary" style={styles.num}>
                  {String(scr.n)}
                </Text>
                <Text variant="small" style={styles.flex}>
                  {scr.name}
                </Text>
                {scr.designed ? null : <Chip label={s.map.proposal} tone="warning" />}
                <Icon name="chevron-right" size={16} color="textMuted" />
              </Tap>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  list: { padding: 0, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 48,
  },
  num: { width: 28, fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
});
