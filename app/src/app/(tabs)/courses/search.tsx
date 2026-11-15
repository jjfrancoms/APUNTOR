import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  Banner,
  Chip,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  Text,
  TextLink,
  type IconName,
} from '@/components/ui';
import { Tap } from '@/components/ui/Tap';
import { useStrings } from '@/i18n/es';
import {
  api,
  ApiRequestError,
  SEARCH_MAX_QUERY,
  SEARCH_MIN_QUERY,
  type ApiSearchResults,
} from '@/lib/api';
import { formatPageRanges } from '@/lib/outline';
import { openSourcePage } from '@/lib/source-page';
import { highlightParts, splitMatch, type TextPart } from '@/lib/text';
import { searchAll, useStore, type SearchHit } from '@/store/store';
import { fonts, layout, radius, space, useTheme, useWide } from '@/theme';

const DEBOUNCE_MS = 300;
const SEARCH_TIMEOUT_MS = 15_000;
const NO_RESULTS: ApiSearchResults = { documents: [], topics: [], snippets: [] };

type Remote = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'offline';
  results: ApiSearchResults;
};

const DEMO_STATUS: Record<string, Remote['status']> = {
  loading: 'loading',
  error: 'error',
  offline: 'offline',
};

/** Busca en el servidor cuando se deja de escribir; descarta las respuestas viejas. */
function useContentSearch(query: string, enabled: boolean): Remote & { retry: () => void } {
  const [remote, setRemote] = useState<Remote>({ status: 'idle', results: NO_RESULTS });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || query.length < SEARCH_MIN_QUERY) {
      setRemote({ status: 'idle', results: NO_RESULTS });
      return;
    }
    // Lo anterior sigue visible mientras llega lo nuevo: la lista no parpadea al escribir.
    setRemote((previous) => ({ status: 'loading', results: previous.results }));
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .search(query, { signal: controller.signal, timeoutMs: SEARCH_TIMEOUT_MS })
        .then((results) => {
          if (!controller.signal.aborted) setRemote({ status: 'ready', results });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const offline =
            error instanceof ApiRequestError &&
            (error.code === 'NETWORK' || error.code === 'NOT_CONFIGURED');
          setRemote({ status: offline ? 'offline' : 'error', results: NO_RESULTS });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, attempt]);
  return { ...remote, retry: () => setAttempt((n) => n + 1) };
}

/**
 * Pantalla 39 · Resultados de búsqueda: documentos, temas y fragmentos de tus apuntes con su
 * página, más los chats del dispositivo. Incluye la 45 (sin resultados).
 * `?demo=loading|error|offline|empty` muestra cada estado.
 */
export default function Search() {
  const s = useStrings();
  const { c } = useTheme();
  const wide = useWide();
  const { demo, q } = useLocalSearchParams<{ demo?: string; q?: string }>();
  const [query, setQuery] = useState(q ?? '');
  const trimmed = query.trim();
  const state = useStore((st) => st);
  const chats = useMemo(
    () => searchAll(trimmed, state).filter((hit) => hit.kind === 'chat'),
    [trimmed, state],
  );
  const demoStatus = demo === undefined ? undefined : DEMO_STATUS[demo];
  const remote = useContentSearch(trimmed, demo === undefined);
  const status = demoStatus ?? remote.status;
  const { documents, topics, snippets } = remote.results;
  const hasRemote = documents.length + topics.length + snippets.length > 0;
  const showEmpty = demo === 'empty' || (status === 'ready' && !hasRemote && chats.length === 0);
  const tooShort = trimmed.length < SEARCH_MIN_QUERY && chats.length === 0 && demo === undefined;

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
          maxLength={SEARCH_MAX_QUERY}
          autoFocus
          style={[styles.input, { color: c.text }]}
        />
        {query.length > 0 ? (
          <IconButton plain icon="x" label={s.search.clear} onPress={() => setQuery('')} />
        ) : null}
      </View>

      {tooShort ? (
        <Text variant="small" color="textMuted">
          {s.search.hint}
        </Text>
      ) : null}
      {status === 'loading' ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <Icon name="refresh-cw" size={14} color="primary" />
          <Text variant="caption" color="textMuted">
            {s.search.loading}
          </Text>
        </View>
      ) : null}
      {status === 'error' || status === 'offline' ? (
        <Banner
          tone={status === 'error' ? 'danger' : 'warning'}
          title={status === 'error' ? s.search.errorTitle : s.search.offlineTitle}
          body={status === 'error' ? s.search.errorBody : s.search.offlineBody}
        >
          <TextLink label={s.search.retry} onPress={remote.retry} />
        </Banner>
      ) : null}

      {showEmpty ? (
        <EmptyState
          mood="curious"
          title={s.empty.search(trimmed)}
          body={s.empty.searchBody}
          primary={{ label: s.empty.clearSearch, onPress: () => setQuery('') }}
          secondary={{ label: s.empty.uploadOne, onPress: () => router.push('/upload') }}
        />
      ) : (
        <>
          {/* En pantalla ancha: documentos y temas a la izquierda, fragmentos de tus apuntes a la derecha. */}
          <View
            style={{
              flexDirection: wide && snippets.length > 0 ? 'row' : 'column',
              gap: space.xxl,
            }}
          >
            <View style={styles.col}>
              <Section title={s.search.documents} visible={documents.length > 0}>
                {documents.map((doc) => (
                  <Tap
                    key={doc.id}
                    accessibilityRole="button"
                    accessibilityLabel={doc.title}
                    onPress={() => router.push(`/documents/${doc.id}`)}
                  >
                    <ResultBox>
                      <TitleRow icon="file-text" title={doc.title} />
                    </ResultBox>
                  </Tap>
                ))}
              </Section>
              <Section title={s.search.topics} visible={topics.length > 0}>
                {topics.map((topic) => (
                  <Tap
                    key={topic.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${topic.title}, ${topic.documentTitle}`}
                    onPress={() =>
                      router.push({
                        pathname: '/topic',
                        params: { doc: topic.documentId, id: topic.id, title: topic.title },
                      })
                    }
                  >
                    <ResultBox>
                      <TitleRow icon="book-open" title={topic.title} />
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {topic.documentTitle}
                      </Text>
                      {topic.pages.length > 0 ? (
                        <Chip
                          label={s.document.pages(
                            topic.pages.length,
                            formatPageRanges(topic.pages),
                          )}
                          tone="primary"
                          icon="file-text"
                        />
                      ) : null}
                    </ResultBox>
                  </Tap>
                ))}
              </Section>
              <Section title={s.search.chats} visible={chats.length > 0}>
                {chats.map((hit) => (
                  <ChatResult key={hit.id} result={hit} query={trimmed} />
                ))}
              </Section>
            </View>
            {snippets.length > 0 ? (
              <View style={styles.col}>
                <Section title={s.search.inNotes} visible={snippets.length > 0}>
                  {snippets.map((hit) => (
                    <Tap
                      key={hit.chunkId}
                      accessibilityRole="link"
                      accessibilityLabel={`${hit.documentTitle}, ${s.search.page(hit.pageNumber)}`}
                      onPress={() => void openSourcePage(hit.documentId, hit.pageNumber)}
                    >
                      <ResultBox>
                        <Text variant="caption" color="textMuted" numberOfLines={1}>
                          {hit.documentTitle}
                        </Text>
                        <Highlighted parts={highlightParts(hit.snippet, hit.highlights)} />
                        <Chip
                          label={s.search.page(hit.pageNumber)}
                          tone="primary"
                          icon="file-text"
                        />
                      </ResultBox>
                    </Tap>
                  ))}
                </Section>
              </View>
            ) : null}
          </View>
        </>
      )}
    </Screen>
  );
}

/** Resultado: sin recuadro, separado del siguiente por una línea fina. */
function ResultBox({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={[
        styles.result,
        { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {children}
    </View>
  );
}

function Section({
  title,
  visible,
  children,
}: {
  title: string;
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <View style={styles.section}>
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TitleRow({ icon, title }: { icon: IconName; title: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color="primary" />
      <Text variant="smallStrong" style={styles.flex}>
        {title}
      </Text>
    </View>
  );
}

function Highlighted({ parts }: { parts: TextPart[] }) {
  return (
    <Text variant="small">
      {parts.map((part, i) =>
        part.hit ? (
          <Text key={i} variant="smallStrong" color="primary">
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

function ChatResult({ result, query }: { result: SearchHit; query: string }) {
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${result.title}, ${result.location}`}
      onPress={() => router.push({ pathname: '/conversation', params: { id: result.targetId } })}
    >
      <ResultBox>
        <TitleRow icon="message-circle" title={result.title} />
        <Text variant="caption" color="textMuted">
          {result.location}
        </Text>
        <Highlighted parts={splitMatch(result.snippet, query)} />
      </ResultBox>
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
  section: { gap: space.xs },
  col: { flex: 1, minWidth: 0, gap: space.xl },
  result: { gap: space.xs, paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
