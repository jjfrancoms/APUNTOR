import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { normalize } from '@/lib/text-search';
import { Card, Chip, Icon, Screen, Text } from '@/components/ui';
import { useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import { localeFor } from '@/lib/format';
import { fonts, layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 23 · Conversaciones (el historial se guarda hasta que lo borres). */
export default function Conversations() {
  const s = useStrings();
  const locale = localeFor(useLanguage());
  const { c } = useTheme();
  const all = useStore((st) => st.conversations);
  const [query, setQuery] = useState('');
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const conversations = all
    .filter((cv) => cv.messages.length > 0)
    .filter(
      (cv) =>
        !query.trim() ||
        normalize(`${cv.title} ${cv.messages.map((m) => m.text).join(' ')}`).includes(
          normalize(query.trim()),
        ),
    )
    .map((cv) => ({
      ...cv,
      group: cv.updatedAt >= startOfToday ? 'today' : 'week',
      time:
        cv.updatedAt >= startOfToday
          ? new Date(cv.updatedAt).toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
            })
          : new Date(cv.updatedAt).toLocaleDateString(locale, { weekday: 'short' }),
      preview: cv.messages.at(-1)?.text || cv.title,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
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
        <Tap
          accessibilityRole="button"
          accessibilityLabel={s.conversations.new}
          onPress={() => router.push('/conversation')}
          style={[styles.add, { backgroundColor: c.primary }]}
        >
          <Icon name="plus" size={20} color="onPrimary" />
        </Tap>
      </View>
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Icon name="search" size={18} color="textMuted" />
        <TextInput
          accessibilityLabel={s.conversations.search}
          placeholder={s.conversations.search}
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, { color: c.text }]}
        />
      </View>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text variant="overline" color="textMuted">
            {g.label}
          </Text>
          {conversations
            .filter((cv) => cv.group === g.key)
            .map((cv) => (
              <Tap
                key={cv.id}
                accessibilityRole="button"
                accessibilityLabel={`${cv.title}, ${cv.time}`}
                onPress={() => router.push({ pathname: '/conversation', params: { id: cv.id } })}
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
                  <Chip label={cv.course || s.tabs.chat} tone="primary" />
                </Card>
              </Tap>
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
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    alignSelf: 'stretch',
    paddingVertical: space.sm,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
