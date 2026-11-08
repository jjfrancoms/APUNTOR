import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Icon, Tap, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { formatPageRanges, outlineSections } from '@/lib/outline';
import type { DocTopic } from '@/store/seed';
import { layout, space, useTheme } from '@/theme';

/**
 * Índice de temas de un documento, con las páginas donde aparece cada uno. Tocar un tema abre
 * su contenido (63): el texto de los apuntes, y desde ahí se le pregunta a Illari.
 */
export function TopicOutline({
  documentId,
  outline,
}: {
  documentId: string;
  outline: readonly DocTopic[];
}) {
  const s = useStrings();
  const { c } = useTheme();
  const ask = (topic: DocTopic) =>
    router.push({
      pathname: '/topic',
      params: { doc: documentId, id: topic.id, title: topic.title },
    });
  const pages = (topic: DocTopic) =>
    topic.pages.length > 0
      ? s.document.pages(topic.pages.length, formatPageRanges(topic.pages))
      : '';

  return (
    <View style={styles.list}>
      {outlineSections(outline).map(({ topic, children }) => (
        <View key={topic.id} style={styles.section}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={s.courses.openTopicLabel(topic.title)}
            onPress={() => ask(topic)}
            style={styles.row}
          >
            <View style={[styles.dot, { backgroundColor: c.primary }]} />
            <Text variant="smallStrong" style={styles.flex}>
              {topic.title}
            </Text>
            <Text variant="caption" color="textMuted">
              {pages(topic)}
            </Text>
            <Icon name="chevron-right" size={14} color="textMuted" />
          </Tap>
          {children.map((child) => (
            <Tap
              key={child.id}
              accessibilityRole="button"
              accessibilityLabel={s.courses.openTopicLabel(child.title)}
              onPress={() => ask(child)}
              style={[styles.row, { paddingLeft: space.md * (child.depth - 1) }]}
            >
              <View style={[styles.dot, styles.small, { backgroundColor: c.textMuted }]} />
              <Text variant="small" style={styles.flex}>
                {child.title}
              </Text>
              <Text variant="caption" color="textMuted">
                {pages(child)}
              </Text>
            </Tap>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  section: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  small: { width: 6, height: 6, borderRadius: 3 },
});
