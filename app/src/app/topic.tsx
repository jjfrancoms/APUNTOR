import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, EmptyState, Mascot, Screen, Text, TopBar } from '@/components/ui';
import { TopicSummary } from '@/components/domain/TopicSummary';
import { useStrings } from '@/i18n/es';
import { api, ApiRequestError, type ApiTopicSummary } from '@/lib/api';
import { formatPageRanges } from '@/lib/outline';
import { space } from '@/theme';

type Load =
  | { state: 'loading' }
  | { state: 'error'; reason: 'failed' | 'busy' | 'limit' }
  | { state: 'ready'; summary: ApiTopicSummary };

/** Por qué falló el resumen: saturación, cuota diaria de resúmenes nuevos u otro fallo. */
function errorReason(error: unknown): 'failed' | 'busy' | 'limit' {
  if (!(error instanceof ApiRequestError)) return 'failed';
  if (error.code === 'RATE_LIMITED') return 'busy';
  if (error.code === 'SUMMARY_DAILY_LIMIT') return 'limit';
  return 'failed';
}

/**
 * Pantalla 63 · Resumen del tema: Illari resume el tema solo con tus apuntes y conserva su
 * estructura (tablas como tablas, fórmulas, figuras recortadas). Cada parte lleva su página, que
 * se puede abrir en el original. Desde aquí se sigue con el chat.
 * `?demo=loading|error|busy|limit|empty` muestra cada estado.
 */
export default function TopicSummaryScreen() {
  const s = useStrings();
  const t = s.topicView;
  const { doc, id, title, demo } = useLocalSearchParams<{
    doc?: string;
    id?: string;
    title?: string;
    demo?: string;
  }>();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchSummary = useCallback(() => {
    if (!doc || !id) {
      setLoad({ state: 'error', reason: 'failed' });
      return;
    }
    setLoad({ state: 'loading' });
    api
      .topicSummary(doc, id)
      .then((summary) => setLoad({ state: 'ready', summary }))
      .catch((error: unknown) =>
        setLoad({
          state: 'error',
          reason: errorReason(error),
        }),
      );
  }, [doc, id]);

  useEffect(() => {
    if (demo === 'loading') return;
    if (demo === 'error' || demo === 'busy' || demo === 'limit') {
      setLoad({ state: 'error', reason: demo === 'error' ? 'failed' : demo });
      return;
    }
    fetchSummary();
  }, [fetchSummary, demo]);

  const summary = load.state === 'ready' ? load.summary : null;
  const topicTitle = summary?.topic.title ?? title ?? t.header;
  const blocks = demo === 'empty' ? [] : (summary?.blocks ?? []);
  const ask = () =>
    router.push({
      pathname: '/conversation',
      params: {
        q: s.courses.askAbout(topicTitle),
        ...(summary ? { docs: summary.document.id } : doc ? { docs: doc } : {}),
      },
    });

  return (
    <Screen
      header={<TopBar title={topicTitle} subtitle={summary?.document.title} />}
      footer={
        load.state === 'ready' ? (
          <>
            <Button label={t.ask} onPress={ask} />
            <Button
              label={t.openDocument}
              variant="secondary"
              onPress={() => router.push(`/documents/${summary?.document.id ?? doc ?? ''}`)}
            />
          </>
        ) : null
      }
    >
      {load.state === 'loading' ? (
        <View style={styles.loading}>
          <Mascot mood="curious" size={96} />
          <Text variant="bodyStrong" align="center">
            {t.loading}
          </Text>
          <Text variant="small" color="textMuted" align="center">
            {t.loadingHint}
          </Text>
        </View>
      ) : load.state === 'error' ? (
        load.reason === 'limit' ? (
          // Sin reintento: la cuota vuelve a medianoche; los resúmenes guardados siguen abriéndose.
          <EmptyState
            mood="sleepy"
            title={t.limitTitle}
            body={t.limitBody}
            primary={{ label: s.common.back, onPress: () => router.back() }}
          />
        ) : (
          <EmptyState
            mood="sleepy"
            title={load.reason === 'busy' ? t.busyTitle : t.errorTitle}
            body={load.reason === 'busy' ? t.busyBody : t.errorBody}
            primary={{ label: t.retry, onPress: fetchSummary }}
          />
        )
      ) : blocks.length === 0 || !summary ? (
        <EmptyState mood="curious" title={t.emptyTitle} body={t.emptyBody} />
      ) : (
        <>
          <View style={styles.meta}>
            {summary.path.length > 1 ? (
              <Text variant="caption" color="textMuted">
                {summary.path.slice(0, -1).join(' › ')}
              </Text>
            ) : null}
            {summary.topic.sourcePages.length > 0 ? (
              <Chip
                label={s.document.pages(
                  summary.topic.sourcePages.length,
                  formatPageRanges(summary.topic.sourcePages),
                )}
                tone="primary"
                icon="file-text"
              />
            ) : null}
            <Text variant="caption" color="textMuted">
              {t.aiNote}
            </Text>
          </View>
          <TopicSummary summary={{ ...summary, blocks }} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { gap: space.sm, alignItems: 'flex-start' },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
});
