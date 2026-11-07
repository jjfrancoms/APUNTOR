import { previewOnly } from '@/components/domain/PreviewOnly';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ShareSheets, type ShareStep } from '@/components/domain/ShareSheets';
import {
  Card,
  Chip,
  Icon,
  IconButton,
  Mascot,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { topicDetail, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

type Tab = 'mine' | 'external' | 'compare';

/** Pantalla 4 · Tema con contexto externo. Propio en verde; externo en violeta y siempre con fuente. */
function TopicDetail() {
  const s = useStrings();
  const { c } = useTheme();
  const { topicId, sheet } = useLocalSearchParams<{ topicId: string; sheet?: string }>();
  const [share, setShare] = useState<ShareStep>(
    sheet === 'share' ? 'create' : sheet === 'created' ? 'created' : 'closed',
  );
  const state = useStore((st) => st);
  const showExternal = state.settings.external;
  const topic = useMemo(
    () => topicDetail(state, topicId) ?? topicDetail(state, 'definicion-limite'),
    [state, topicId],
  );
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
  // Si el usuario apagó el contexto externo en Perfil, no se muestra.
  const external =
    showExternal && topic.external ? (
      <Card tone="external">
        <View style={styles.row}>
          <Chip label={s.topic.externalContext} tone="external" icon="globe" />
          <Text variant="caption" color="textMuted" style={styles.flex}>
            {topic.external.source}
          </Text>
        </View>
        <Text variant="small">{topic.external.text}</Text>
        <View style={styles.row}>
          <TextLink
            label={s.topic.seeSource}
            color="external"
            onPress={() =>
              topic.external &&
              void Linking.openURL(
                `https://${topic.external.source.includes('.') ? topic.external.source : 'es.wikipedia.org'}`,
              )
            }
          />
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
    <Screen
      header={
        <TopBar
          title={topic.breadcrumb.join(' › ')}
          right={
            <IconButton icon="share-2" label={s.share.header} onPress={() => setShare('create')} />
          }
        />
      }
    >
      <Text variant="title" accessibilityRole="header">
        {topic.title}
      </Text>
      <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
        {(Object.keys(s.topic.tabs) as Tab[]).map((key) => {
          const active = key === tab;
          return (
            <Tap
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, active && { backgroundColor: c.surface }]}
            >
              <Text variant="smallStrong" color={active ? 'text' : 'textMuted'}>
                {s.topic.tabs[key]}
              </Text>
            </Tap>
          );
        })}
      </View>
      {tab !== 'external' ? own : null}
      {tab !== 'mine' ? external : null}
      {tab === 'compare' && topic.notes.length > 0 ? (
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
            <TextLink label={s.topic.askMascot} onPress={() => router.push('/conversation')} />
          </View>
        </Card>
      ) : null}
      <ShareSheets step={share} onStep={setShare} topicId={topic.id} />
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
    minHeight: layout.minTouchTarget,
  },
});

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(TopicDetail);
