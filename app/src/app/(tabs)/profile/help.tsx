import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Card, Icon, Screen, Text, TextLink, TopBar, type IconName } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { normalize } from '@/lib/text-search';
import { fonts, layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

const CATEGORY_ICONS: IconName[] = ['upload', 'shield', 'layers', 'credit-card'];

/** Pantalla 42 · Centro de ayuda: búsqueda, categorías y respuestas desplegables. */
export default function Help() {
  const s = useStrings();
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const faqs = s.help.faqs.map((q, i) => ({ i, q, a: s.helpView.answers[i] ?? '' }));
  const inCategory =
    category === null
      ? faqs
      : faqs.filter((f) => (s.helpView.categories[category] as readonly number[]).includes(f.i));
  const visible = query.trim()
    ? inCategory.filter((f) => normalize(`${f.q} ${f.a}`).includes(normalize(query.trim())))
    : inCategory;
  return (
    <Screen header={<TopBar title={s.help.header} />}>
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Icon name="search" size={18} color="textMuted" />
        <TextInput
          accessibilityLabel={s.help.search}
          placeholder={s.help.search}
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, { color: c.text }]}
        />
      </View>
      <View style={styles.grid}>
        {s.help.categories.map((label, i) => {
          const active = category === i;
          return (
            <Tap
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              onPress={() => setCategory(active ? null : i)}
              style={[
                styles.tile,
                {
                  backgroundColor: active ? c.primarySoft : c.surface,
                  borderColor: active ? c.primary : c.border,
                },
              ]}
            >
              <View
                style={[styles.tileIcon, { backgroundColor: active ? c.surface : c.primarySoft }]}
              >
                <Icon name={CATEGORY_ICONS[i] ?? 'help-circle'} size={18} color="primary" />
              </View>
              <Text variant="smallStrong">{label}</Text>
            </Tap>
          );
        })}
      </View>
      <View style={styles.row}>
        <Text variant="overline" color="textMuted" style={styles.flex}>
          {s.help.faqHeader}
        </Text>
        {category !== null ? (
          <TextLink
            label={s.helpView.allFaqs}
            variant="caption"
            onPress={() => setCategory(null)}
          />
        ) : null}
      </View>
      <Card style={styles.list}>
        {visible.length === 0 ? (
          <Text variant="small" color="textMuted" style={styles.empty}>
            {s.helpView.noResults}
          </Text>
        ) : (
          visible.map((f, idx) => {
            const expanded = open === f.i;
            return (
              <Tap
                key={f.q}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setOpen(expanded ? null : f.i)}
                style={[
                  styles.faq,
                  idx > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={styles.row}>
                  <Text variant="bodyStrong" style={styles.flex}>
                    {f.q}
                  </Text>
                  <Icon
                    name={expanded ? 'chevron-down' : 'chevron-right'}
                    size={18}
                    color="textMuted"
                  />
                </View>
                {expanded ? (
                  <Text variant="small" color="textMuted">
                    {f.a}
                  </Text>
                ) : null}
              </Tap>
            );
          })
        )}
      </Card>
      <Tap accessibilityRole="button" onPress={() => router.push('/profile/contact')}>
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
      </Tap>
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
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    alignSelf: 'stretch',
    paddingVertical: space.sm,
    outlineWidth: 0,
    outlineColor: 'transparent',
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
  faq: { padding: space.lg, gap: space.sm, minHeight: layout.minTouchTarget + 12 },
  empty: { padding: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
