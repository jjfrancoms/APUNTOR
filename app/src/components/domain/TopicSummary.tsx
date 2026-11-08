import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Tap, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import type { ApiSummaryBlock, ApiTopicSummary } from '@/lib/api';
import { formatPageRanges } from '@/lib/outline';
import { radius, space, useTheme } from '@/theme';

/** Celda mínima: una tabla ancha se desplaza de lado en vez de aplastarse. */
const MIN_CELL_WIDTH = 72;

/**
 * Resumen de un tema con la estructura del original: subtítulos, párrafos, listas, tablas
 * (dibujadas como tablas), fórmulas y figuras recortadas de la página. Cada parte muestra su
 * página; tocarla abre la página original para comprobar el resumen.
 */
export function TopicSummary({ summary }: { summary: ApiTopicSummary }) {
  const s = useStrings();
  const t = s.topicView;
  const { c } = useTheme();
  const images = new Map(summary.pageImages.map((p) => [p.pageNumber, p.url]));

  const pageChip = (pages: readonly number[]) => {
    if (pages.length === 0) return null;
    const first = pages[0];
    const url = first === undefined ? undefined : images.get(first);
    const chip = <Chip label={t.pages(formatPageRanges(pages))} tone="primary" icon="file-text" />;
    if (!url || first === undefined) return <View style={styles.chip}>{chip}</View>;
    return (
      <Tap
        accessibilityRole="link"
        accessibilityLabel={t.checkPage(first)}
        onPress={() => void Linking.openURL(url)}
        hitSlop={8}
        style={styles.chip}
      >
        {chip}
      </Tap>
    );
  };

  const render = (block: ApiSummaryBlock, i: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <Text key={i} variant="subheading" accessibilityRole="header">
            {block.text}
          </Text>
        );
      case 'paragraph':
        return (
          <View key={i} style={styles.block}>
            <Text variant="body" selectable>
              {block.text}
            </Text>
            {pageChip(block.pages)}
          </View>
        );
      case 'list':
        return (
          <View key={i} style={styles.block}>
            {block.items.map((item, n) => (
              <View key={n} style={styles.item}>
                <View style={[styles.bullet, { backgroundColor: c.primary }]} />
                <Text variant="body" selectable style={styles.flex}>
                  {item}
                </Text>
              </View>
            ))}
            {pageChip(block.pages)}
          </View>
        );
      case 'table':
        return (
          <View key={i} style={styles.block}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={[styles.table, { borderColor: c.border }]}>
                {[block.header, ...block.rows].map((row, r) => (
                  <View
                    key={r}
                    style={[
                      styles.row,
                      { borderColor: c.border },
                      r === 0 && { backgroundColor: c.primarySoft },
                    ]}
                  >
                    {row.map((cell, k) => (
                      <View
                        key={k}
                        style={[
                          styles.cell,
                          { borderColor: c.border },
                          k === row.length - 1 && styles.lastCell,
                        ]}
                      >
                        <Text variant={r === 0 ? 'smallStrong' : 'small'} align="center" selectable>
                          {cell}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
            {pageChip(block.pages)}
          </View>
        );
      case 'formula':
        return (
          <View key={i} style={styles.block}>
            <Card style={styles.formula}>
              <Text variant="bodyStrong" align="center" selectable>
                {block.text}
              </Text>
            </Card>
            {pageChip(block.pages)}
          </View>
        );
      case 'figure':
        return (
          <View key={i} style={styles.block}>
            <View style={[styles.figure, { borderColor: c.border }]}>
              <Image
                source={{ uri: block.url }}
                resizeMode="contain"
                accessibilityLabel={t.figure(block.caption, block.page)}
                style={[styles.image, { aspectRatio: block.width / block.height }]}
              />
            </View>
            {block.caption ? (
              <Text variant="caption" color="textMuted">
                {block.caption}
              </Text>
            ) : null}
            {pageChip([block.page])}
          </View>
        );
    }
  };

  return <View style={styles.list}>{summary.blocks.map(render)}</View>;
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  block: { gap: space.sm },
  flex: { flex: 1 },
  chip: { alignSelf: 'flex-start' },
  item: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: {
    minWidth: MIN_CELL_WIDTH,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  lastCell: { borderRightWidth: 0 },
  formula: { paddingVertical: space.md },
  // La figura es un recorte de la página (fondo blanco): se ve igual en modo oscuro.
  figure: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  image: { width: '100%' },
});
