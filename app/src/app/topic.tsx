import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FilterChips,
  Screen,
  Tap,
  Text,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { api, type ApiTopicContent } from '@/lib/api';
import { formatPageRanges } from '@/lib/outline';
import { radius, space, useTheme } from '@/theme';

type Load =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; content: ApiTopicContent };
type View_ = 'pages' | 'text';

/**
 * Pantalla 63 · Contenido del tema: lo que dicen tus apuntes sobre el tema, para leerlo y
 * después profundizar con Illari. Dos vistas: la página original (PDF: tablas, fórmulas y
 * gráficos tal cual) y el texto con sus saltos de línea (para leer y copiar).
 * `?demo=loading|error|empty` muestra cada estado.
 */
export default function TopicContent() {
  const s = useStrings();
  const t = s.topicView;
  const { c } = useTheme();
  const { doc, id, title, demo } = useLocalSearchParams<{
    doc?: string;
    id?: string;
    title?: string;
    demo?: string;
  }>();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [view, setView] = useState<View_ | null>(null);

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
  const images = demo === 'empty' ? [] : (content?.pageImages ?? []);
  // Por defecto, la página original si existe: conserva tablas, fórmulas y gráficos.
  const current: View_ = view ?? (images.length > 0 ? 'pages' : 'text');
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
          {blocks.length === 0 && images.length === 0 ? (
            <EmptyState mood="curious" title={t.emptyTitle} body={t.emptyBody} />
          ) : (
            <>
              <Text variant="subheading" accessibilityRole="header">
                {t.fromNotes}
              </Text>
              {images.length > 0 ? (
                <FilterChips
                  options={[
                    { value: 'pages', label: t.viewPages },
                    { value: 'text', label: t.viewText },
                  ]}
                  value={current}
                  onChange={setView}
                />
              ) : null}
              {current === 'pages' ? (
                <>
                  <Text variant="caption" color="textMuted">
                    {t.openImage}
                  </Text>
                  {images.map((image) => (
                    <View key={image.pageNumber} style={styles.pageWrap}>
                      <Chip label={t.page(image.pageNumber)} tone="primary" />
                      <Tap
                        accessibilityRole="imagebutton"
                        accessibilityLabel={t.pageImage(image.pageNumber)}
                        onPress={() => void Linking.openURL(image.url)}
                        style={[styles.page, { borderColor: c.border, backgroundColor: c.surface }]}
                      >
                        <Image
                          source={{ uri: image.url }}
                          resizeMode="contain"
                          style={[styles.image, { aspectRatio: image.width / image.height }]}
                        />
                      </Tap>
                    </View>
                  ))}
                </>
              ) : (
                blocks.map((block, i) => {
                  const heading = block.sectionPath.at(-1);
                  const showHeading =
                    heading !== undefined &&
                    heading !== content?.topic.title &&
                    blocks[i - 1]?.sectionPath.at(-1) !== heading;
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
                })
              )}
              {content?.truncated && current === 'text' ? (
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
  pageWrap: { gap: space.sm, alignItems: 'flex-start' },
  page: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  image: { width: '100%' },
});
