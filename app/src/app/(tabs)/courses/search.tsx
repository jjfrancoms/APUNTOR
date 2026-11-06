import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Card, Chip, EmptyState, Icon, IconButton, Screen, Text } from '@/components/ui';
import { searchAll, useStore, type SearchHit } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { splitMatch } from '@/lib/text';
import { fonts, layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

type Filter = 'all' | 'document' | 'chat';

/** Pantalla 39 · Resultados de búsqueda (títulos y contenido). */
export default function Search() {
  const s = useStrings();
  const { c } = useTheme();
  const { demo, q } = useLocalSearchParams<{ demo?: string; q?: string }>();
  const [query, setQuery] = useState(q ?? '');
  const [cleared, setCleared] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const state = useStore((st) => st);
  const matches = useMemo(() => searchAll(query, state), [query, state]);
  const docs = matches.filter((r) => r.kind === 'document').length;
  const chats = matches.length - docs;
  const visible = filter === 'all' ? matches : matches.filter((r) => r.kind === filter);
  const labels = s.search.tabs(matches.length, docs, chats);
  const filters: Filter[] = ['all', 'document', 'chat'];

  // Pantalla 45 · Búsqueda sin resultados (`?demo=empty` la fuerza con la consulta del diseño).
  if ((demo === 'empty' && !cleared) || (query.trim().length > 0 && matches.length === 0)) {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {s.empty.searchTitle}
        </Text>
        <EmptyState
          mood="curious"
          title={s.empty.search(query.trim())}
          body={s.empty.searchBody}
          primary={{
            label: s.empty.clearSearch,
            onPress: () => {
              setCleared(true);
              setQuery('');
            },
          }}
          secondary={{ label: s.empty.uploadOne, onPress: () => router.push('/upload') }}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <View style={[styles.field, { borderColor: c.primary, backgroundColor: c.surface }]}>
        <Icon name="search" size={18} color="textMuted" />
        <TextInput
          accessibilityLabel={s.search.placeholder}
          placeholder={s.search.placeholder}
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          style={[styles.input, { color: c.text }]}
        />
        {query.length > 0 ? (
          <IconButton plain icon="x" label={s.search.clear} onPress={() => setQuery('')} />
        ) : null}
      </View>
      <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
        {filters.map((f, i) => (
          <Tap
            key={f}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={[styles.segmentItem, filter === f && { backgroundColor: c.surface }]}
          >
            <Text variant="smallStrong" color={filter === f ? 'text' : 'textMuted'}>
              {labels[i] ?? ''}
            </Text>
          </Tap>
        ))}
      </View>
      {visible.length === 0 && query.trim().length > 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyStrong" align="center">
            {s.search.empty(query.trim())}
          </Text>
          <Text variant="small" color="textMuted" align="center">
            {s.search.emptyHint}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="caption" color="textMuted">
            {s.search.count(visible.length)}
          </Text>
          {visible.map((r) => (
            <ResultCard key={r.id} result={r} query={query.trim()} />
          ))}
        </>
      )}
    </Screen>
  );
}

function ResultCard({ result, query }: { result: SearchHit; query: string }) {
  const parts = splitMatch(result.snippet, query);
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${result.title}, ${result.location}`}
      onPress={() =>
        router.push(
          result.kind === 'document'
            ? `/documents/${result.targetId}`
            : { pathname: '/conversation', params: { id: result.targetId } },
        )
      }
    >
      <Card>
        <View style={styles.row}>
          <Icon
            name={result.kind === 'document' ? 'file-text' : 'message-circle'}
            size={16}
            color="primary"
          />
          <Text variant="smallStrong" style={styles.flex}>
            {result.title}
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          {result.location}
        </Text>
        <Text variant="small">
          {parts.map((p, i) =>
            p.hit ? (
              <Text key={i} variant="smallStrong" color="primary">
                {p.text}
              </Text>
            ) : (
              p.text
            ),
          )}
        </Text>
        <Chip label={result.tag} tone="primary" />
      </Card>
    </Tap>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 4,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    paddingVertical: space.sm,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    minHeight: layout.minTouchTarget,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  empty: { alignItems: 'center', gap: space.xs, paddingVertical: space.xxxl },
});
