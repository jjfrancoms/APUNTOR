import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Button, Chip, EmptyState, Screen, Text, TopBar } from '@/components/ui';
import { StudyLoading } from '@/components/domain/StudyState';
import { TopicSummary } from '@/components/domain/TopicSummary';
import { useStrings } from '@/i18n/es';
import { api, ApiRequestError, type ApiTopicSummary } from '@/lib/api';
import { formatPageRanges } from '@/lib/outline';
import { space, useWide } from '@/theme';

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
  const wide = useWide();
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

  /** Abre la configuración de un quiz o de tarjetas ya apuntando a este tema. */
  const practice = (kind: 'quiz' | 'cards') =>
    router.push({
      pathname: '/study/quiz-setup',
      params: {
        doc: summary?.document.id ?? doc ?? '',
        ...(id ? { topic: id } : {}),
        topicTitle,
        kind,
      },
    });

  const metaBlock = summary ? (
    <View style={[styles.meta, wide && styles.metaWide]}>
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
  ) : null;
  const openDocument = () => router.push(`/documents/${summary?.document.id ?? doc ?? ''}`);
  // Pantalla ancha: las acciones van en la columna de la derecha. En móvil, una principal al pie y
  // las otras tres en una fila de botones pequeños.

  return (
    <Screen
      wide
      header={<TopBar title={topicTitle} subtitle={summary?.document.title} />}
      footer={
        load.state === 'ready' && !wide ? (
          <>
            <Button label={t.ask} onPress={ask} />
            <View style={styles.study}>
              <View style={styles.flex}>
                <Button
                  label={s.study.practice}
                  variant="secondary"
                  size="sm"
                  onPress={() => practice('quiz')}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label={s.study.cards}
                  variant="secondary"
                  size="sm"
                  onPress={() => practice('cards')}
                />
              </View>
              <View style={styles.flexWide}>
                <Button
                  label={t.openDocument}
                  variant="secondary"
                  size="sm"
                  onPress={openDocument}
                />
              </View>
            </View>
          </>
        ) : null
      }
    >
      {load.state === 'loading' ? (
        <StudyLoading title={t.loading} hint={t.loadingHint} />
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
        <View style={[styles.layout, wide && styles.layoutWide]}>
          {wide ? null : metaBlock}
          <View style={styles.main}>
            <TopicSummary summary={{ ...summary, blocks }} />
          </View>
          {wide ? (
            <View style={[styles.aside, stickyTop]}>
              {metaBlock}
              <View style={styles.actions}>
                <Button label={t.ask} onPress={ask} />
                <View style={styles.actionsRow}>
                  <View style={styles.flex}>
                    <Button
                      label={s.study.practice}
                      variant="secondary"
                      size="sm"
                      onPress={() => practice('quiz')}
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      label={s.study.cards}
                      variant="secondary"
                      size="sm"
                      onPress={() => practice('cards')}
                    />
                  </View>
                </View>
                <Button label={t.openDocument} variant="ghost" size="sm" onPress={openDocument} />
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

// En web la columna de acciones se queda a la vista al desplazar (`sticky`, que RN no tipa).
const stickyTop: ViewStyle | undefined =
  Platform.OS === 'web'
    ? ({ position: 'sticky', top: space.lg } as unknown as ViewStyle)
    : undefined;

const styles = StyleSheet.create({
  meta: { gap: space.sm, alignItems: 'flex-start' },
  study: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  flexWide: { flex: 1.6 },
  layout: { gap: space.lg, paddingBottom: space.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  main: { flex: 1, minWidth: 0, maxWidth: 680 },
  metaWide: { gap: space.sm },
  aside: { width: 280, gap: space.xl },
  actions: { gap: space.sm },
  actionsRow: { flexDirection: 'row', gap: space.sm },
});
