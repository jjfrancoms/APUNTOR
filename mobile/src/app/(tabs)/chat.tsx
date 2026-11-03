import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Chip, Icon, Screen, Text } from '@/components/ui';
import { conversations } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

/** Pantalla 23 · Conversaciones (el historial se guarda hasta que lo borres). */
export default function Conversations() {
  const s = useStrings();
  const { c } = useTheme();
  const groups = [
    { key: 'today', label: s.conversations.today },
    { key: 'week', label: s.conversations.week },
  ] as const;
  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="display" accessibilityRole="header" style={styles.flex}>
          {s.conversations.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.conversations.new}
          onPress={() => router.push('/conversation')}
          style={[styles.add, { backgroundColor: c.primary }]}
        >
          <Icon name="plus" size={20} color="onPrimary" />
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Icon name="search" size={18} color="textMuted" />
        <Text variant="body" color="textMuted">
          {s.conversations.search}
        </Text>
      </View>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text variant="overline" color="textMuted">
            {g.label}
          </Text>
          {conversations
            .filter((cv) => cv.group === g.key)
            .map((cv) => (
              <Pressable
                key={cv.id}
                accessibilityRole="button"
                accessibilityLabel={`${cv.title}, ${cv.time}`}
                onPress={() => router.push('/conversation')}
              >
                <Card>
                  <View style={styles.row}>
                    <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                      {cv.title}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {cv.time}
                    </Text>
                  </View>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {cv.preview}
                  </Text>
                  <Chip label={cv.course} tone="primary" />
                </Card>
              </Pressable>
            ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  add: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 4,
  },
  group: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
