import { previewOnly } from '@/components/domain/PreviewOnly';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import {
  ChatScreen,
  Composer,
  courseCount,
  MascotBubble,
  UserBubble,
} from '@/components/chat/Chat';
import { Button, Card, Icon, Text } from '@/components/ui';
import { chatOutside } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 30 · Fuera de tus documentos: lo externo va aparte, en violeta y con fuente. */
function ChatOutside() {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <ChatScreen
      subtitle={s.chat.knowsShort(courseCount)}
      composer={<Composer placeholder={s.chat.placeholderShort} />}
    >
      <UserBubble text={chatOutside.question} />
      <MascotBubble>
        <Text variant="small">{s.chat.notFound}</Text>
        <View style={styles.actions}>
          <Tap
            accessibilityRole="button"
            onPress={() =>
              router.replace({ pathname: '/conversation', params: { q: chatOutside.question } })
            }
            style={[styles.pill, { backgroundColor: c.external }]}
          >
            <Icon name="globe" size={14} color="onPrimary" />
            <Text variant="smallStrong" color="onPrimary">
              {s.chat.searchOutside}
            </Text>
          </Tap>
          <Button
            label={s.chat.uploadMaterial}
            variant="secondary"
            icon="upload"
            compact
            onPress={() => router.push('/upload')}
          />
        </View>
      </MascotBubble>
      <Card tone="external" style={{ backgroundColor: c.externalSoft }}>
        <View style={styles.row}>
          <Icon name="globe" size={14} color="external" />
          <Text variant="smallStrong" color="external" accessibilityRole="header">
            {s.chat.externalAnswer}
          </Text>
        </View>
        <Text variant="small">{chatOutside.answer}</Text>
        <Tap
          accessibilityRole="link"
          accessibilityLabel={`${chatOutside.sourceTitle}, ${chatOutside.sourceHost}`}
          onPress={() => void Linking.openURL(`https://${chatOutside.sourceHost}`)}
          style={[styles.source, { backgroundColor: c.surface }]}
        >
          <View style={styles.flex}>
            <Text variant="smallStrong">{chatOutside.sourceTitle}</Text>
            <Text variant="caption" color="external">
              {chatOutside.sourceHost}
            </Text>
          </View>
          <Icon name="external-link" size={14} color="external" />
        </Tap>
        <Text variant="caption" color="textMuted">
          {s.chat.externalDisclaimer}
        </Text>
      </Card>
    </ChatScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 40,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.md,
  },
  flex: { flex: 1 },
});

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(ChatOutside);
