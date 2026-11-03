import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, ListRow, Screen, Text, TopBar, type IconName } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

const CATEGORY_ICONS: IconName[] = ['upload', 'shield', 'layers', 'credit-card'];

/** Pantalla 42 · Centro de ayuda */
export default function Help() {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <Screen header={<TopBar title={s.help.header} />}>
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Icon name="search" size={18} color="textMuted" />
        <Text variant="body" color="textMuted">
          {s.help.search}
        </Text>
      </View>
      <View style={styles.grid}>
        {s.help.categories.map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <View style={[styles.tileIcon, { backgroundColor: c.primarySoft }]}>
              <Icon name={CATEGORY_ICONS[i] ?? 'help-circle'} size={18} color="primary" />
            </View>
            <Text variant="smallStrong">{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text variant="overline" color="textMuted">
        {s.help.faqHeader}
      </Text>
      <Card style={styles.list}>
        {s.help.faqs.map((q, i) => (
          <ListRow
            key={q}
            title={q}
            divider={i < s.help.faqs.length - 1}
            onPress={() => undefined}
          />
        ))}
      </Card>
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile/contact')}>
        <Card tone="primary" style={styles.row}>
          <View style={styles.flex}>
            <Text variant="bodyStrong" color="primary">
              {s.help.notFoundTitle}
            </Text>
            <Text variant="caption" color="textMuted">
              {s.help.notFoundBody}
            </Text>
          </View>
          <Icon name="chevron-right" color="primary" />
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
