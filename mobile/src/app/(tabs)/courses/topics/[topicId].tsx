import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Chip, Icon, Mascot, Screen, Text, TextLink, TopBar } from '@/components/ui';
import { topics } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

type Tab = 'mine' | 'external' | 'compare';

/** Pantalla 4 · Tema con contexto externo. Propio en verde; externo en violeta y siempre con fuente. */
export default function TopicDetail() {
  const s = useStrings();
  const { c } = useTheme();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = topics[topicId] ?? topics['definicion-limite'];
  const [tab, setTab] = useState<Tab>('compare');
  if (!topic) return null;

  const own = (
    <Card style={{ borderColor: c.primary }}>
      <View style={styles.row}>
        <Chip label={s.topic.yourMaterial} tone="primary" icon="file-text" />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {topic.own.source}
        </Text>
      </View>
      <Text variant="small">{topic.own.text}</Text>
    </Card>
  );
  const external = topic.external ? (
    <Card tone="external">
      <View style={styles.row}>
        <Chip label={s.topic.externalContext} tone="external" icon="globe" />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {topic.external.source}
        </Text>
      </View>
      <Text variant="small">{topic.external.text}</Text>
      <View style={styles.row}>
        <TextLink label={s.topic.seeSource} color="external" />
        <Icon name="external-link" size={12} color="external" />
      </View>
    </Card>
  ) : (
    <Card>
      <Text variant="small" color="textMuted">
        {s.topic.externalEmpty}
      </Text>
    </Card>
  );

  return (
    <Screen header={<TopBar title={topic.breadcrumb.join(' › ')} />}>
      <Text variant="title" accessibilityRole="header">
        {topic.title}
      </Text>
      <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
        {(Object.keys(s.topic.tabs) as Tab[]).map((key) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, active && { backgroundColor: c.surface }]}
            >
              <Text variant="smallStrong" color={active ? 'text' : 'textMuted'}>
                {s.topic.tabs[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {tab !== 'external' ? own : null}
      {tab !== 'mine' ? external : null}
      {tab === 'compare' ? (
        <Card tone="accent">
          <View style={styles.row}>
            <Mascot size={40} />
            <Text variant="smallStrong">{s.topic.noticed}</Text>
          </View>
          {topic.notes.map((note) => (
            <Text key={note} variant="small">
              {`• ${note}`}
            </Text>
          ))}
          <View style={styles.row}>
            <Icon name="message-circle" size={14} color="primary" />
            <TextLink label={s.topic.askMascot} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    minHeight: layout.minTouchTarget - 4,
  },
});
