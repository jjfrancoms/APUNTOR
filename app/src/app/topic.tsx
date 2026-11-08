import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, EmptyState, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { api, type ApiTopicContent } from '@/lib/api';
import { formatPageRanges } from '@/lib/outline';
import { space } from '@/theme';

type Load =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; content: ApiTopicContent };

/**
 * Pantalla 63 · Contenido del tema: el texto de tus apuntes donde se trata el tema, página por
 * página, para leerlo y después profundizar con Illari. Sale de los fragmentos ya guardados.
 * `?demo=loading|error|empty` muestra cada estado.
 */
export default function TopicContent() {
  const s = useStrings();
  const t = s.topicView;
  const { doc, id, title, demo } = useLocalSearchParams<{
    doc?: string;
    id?: string;
    title?: string;
    demo?: string;
  }>();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchContent = useCallback(() => {
    if (!doc || !id) {
      setLoad({ state: 'error' });
      return;
    }
    setLoad({ state: 'loading' });
    api
      .topicContent(doc, id)
      .then((content) => setLoad({ state: 'ready', content }))
      .catch(() => setLoad({ state: 'error' }));
  }, [doc, id]);

  useEffect(() => {
    if (demo === 'loading') return;
    if (demo === 'error') {
      setLoad({ state: 'error' });
      return;
    }
    fetchContent();
  }, [fetchContent, demo]);

  const content = load.state === 'ready' ? load.content : null;
  const topicTitle = content?.topic.title ?? title ?? t.header;
  const blocks = demo === 'empty' ? [] : (content?.blocks ?? []);
  const ask = () =>
    router.push({ pathname: '/conversation', params: { q: s.courses.askAbout(topicTitle) } });

  return (
    <Screen
      header={<TopBar title={topicTitle} subtitle={content?.document.title} />}
      footer={
        load.state === 'ready' ? (
          <>
            <Button label={t.ask} onPress={ask} />
            <Button
              label={t.openDocument}
              variant="secondary"
              onPress={() => router.push(`/documents/${content?.document.id ?? doc ?? ''}`)}
            />
          </>
        ) : null
      }
    >
      {load.state === 'loading' ? (
        <Text variant="small" color="textMuted" align="center">
          {t.loading}
        </Text>
      ) : load.state === 'error' ? (
        <EmptyState
          mood="sleepy"
          title={t.errorTitle}
          body={t.errorBody}
          primary={{ label: t.retry, onPress: fetchContent }}
        />
      ) : (
        <>
          <View style={styles.meta}>
            {content && content.path.length > 1 ? (
              <Text variant="caption" color="textMuted">
                {content.path.slice(0, -1).join(' › ')}
              </Text>
            ) : null}
            {content && content.topic.sourcePages.length > 0 ? (
              <Chip
                label={s.document.pages(
                  content.topic.sourcePages.length,
                  formatPageRanges(content.topic.sourcePages),
                )}
                tone="primary"
                icon="file-text"
              />
            ) : null}
          </View>
          {blocks.length === 0 ? (
            <EmptyState mood="curious" title={t.emptyTitle} body={t.emptyBody} />
          ) : (
            <>
              <Text variant="subheading" accessibilityRole="header">
                {t.fromNotes}
              </Text>
              {blocks.map((block, i) => {
                const heading = block.sectionPath.at(-1);
                const showHeading =
                  heading !== undefined && heading !== content?.topic.title && i > 0
                    ? blocks[i - 1]?.sectionPath.at(-1) !== heading
                    : heading !== undefined && heading !== content?.topic.title;
                return (
                  <Card key={`${block.pageNumber}-${i}`} style={styles.block}>
                    <View style={styles.blockHead}>
                      {showHeading ? (
                        <Text variant="smallStrong" style={styles.flex}>
                          {heading}
                        </Text>
                      ) : (
                        <View style={styles.flex} />
                      )}
                      <Chip label={t.page(block.pageNumber)} tone="primary" />
                    </View>
                    <Text variant="body" selectable>
                      {block.text}
                    </Text>
                  </Card>
                );
              })}
              {content?.truncated ? (
                <Text variant="small" color="textMuted" align="center">
                  {t.truncated}
                </Text>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { gap: space.sm, alignItems: 'flex-start' },
  block: { gap: space.sm },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
