import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Tap, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { formatPageRanges, outlineTree, toggleExpanded, type OutlineNode } from '@/lib/outline';
import type { DocTopic } from '@/store/seed';
import { layout, space, useTheme } from '@/theme';

/**
 * Índice desplegable de los temas de un documento. Al principio solo se ven los temas
 * principales: tocar uno muestra sus secciones y tocarlo otra vez las esconde. Un tema sin
 * secciones abre su resumen (63); uno con secciones lo ofrece como primera fila al desplegarlo.
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
  const tree = useMemo(() => outlineTree(outline), [outline]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const open = (topic: DocTopic) =>
    router.push({
      pathname: '/topic',
      params: { doc: documentId, id: topic.id, title: topic.title },
    });
  const pages = (topic: DocTopic) =>
    topic.pages.length > 0
      ? s.document.pages(topic.pages.length, formatPageRanges(topic.pages))
      : '';

  const renderNode = (node: OutlineNode, level: number) => {
    const { topic, children } = node;
    const hasChildren = children.length > 0;
    const isOpen = expanded.has(topic.id);
    const indent = { paddingLeft: space.lg * level };
    return (
      <View key={topic.id}>
        <Tap
          accessibilityRole="button"
          accessibilityState={hasChildren ? { expanded: isOpen } : undefined}
          accessibilityLabel={hasChildren ? topic.title : s.courses.openTopicLabel(topic.title)}
          onPress={() => (hasChildren ? setExpanded(toggleExpanded(expanded, node)) : open(topic))}
          style={[styles.row, indent]}
        >
          {hasChildren ? (
            <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={16} color="textMuted" />
          ) : (
            <View
              style={[styles.dot, { backgroundColor: level === 0 ? c.primary : c.textMuted }]}
            />
          )}
          <Text variant={level === 0 ? 'smallStrong' : 'small'} style={styles.flex}>
            {topic.title}
          </Text>
          <Text variant="caption" color="textMuted">
            {pages(topic)}
          </Text>
          {hasChildren ? null : <Icon name="chevron-right" size={14} color="textMuted" />}
        </Tap>
        {hasChildren && isOpen ? (
          <>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={s.courses.openTopicLabel(topic.title)}
              onPress={() => open(topic)}
              style={[styles.row, { paddingLeft: space.lg * (level + 1) }]}
            >
              <Icon name="book-open" size={14} color="primary" />
              <Text variant="small" color="primary" style={styles.flex}>
                {s.courses.summaryOf(topic.title)}
              </Text>
            </Tap>
            {children.map((child) => renderNode(child, level + 1))}
          </>
        ) : null}
      </View>
    );
  };

  return <View style={styles.list}>{tree.map((node) => renderNode(node, 0))}</View>;
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
  flex: { flex: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 5 },
});
