import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  ChatScreen,
  Composer,
  MascotBubble,
  MascotStage,
  UserBubble,
} from '@/components/chat/Chat';
import {
  Banner,
  Button,
  Card,
  Chip,
  Icon,
  Mascot,
  ProgressBar,
  Text,
  TextLink,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import {
  answerQuestion,
  askQuestion,
  dailyQuestionLimit,
  questionsToday,
  searchOutside,
  startConversation,
  useStore,
  type Message,
} from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/**
 * Pantalla 5 · Chat con la mascota (con 24 respondiendo, 25 límite y 30 fuera de tus documentos).
 * Responde solo con fragmentos de tus documentos y cita la página; si no los hay, se abstiene
 * y ofrece buscar fuera, siempre aparte y con fuente.
 */
export default function Conversation() {
  const s = useStrings();
  const { c } = useTheme();
  const params = useLocalSearchParams<{ id?: string; q?: string }>();
  const [id, setId] = useState<string | null>(params.id ?? null);
  const conv = useStore((st) => st.conversations.find((cv) => cv.id === id));
  const courseCount = useStore((st) => st.courses.length);
  const externalOn = useStore((st) => st.settings.external);
  const asked = useStore(questionsToday);
  const limit = useStore(dailyQuestionLimit);
  const plan = useStore((st) => st.plan);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    if (!id) setId(startConversation());
  }, [id]);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const send = (text: string) => {
    if (!id || thinking || text.trim().length === 0) return;
    setDraft('');
    if (!askQuestion(id, text)) return; // límite diario: el mensaje queda con el aviso
    setThinking(true);
    void answerQuestion(id, text).finally(() => {
      if (mounted.current) setThinking(false);
    });
  };
  const outside = () => {
    if (!id || thinking) return;
    setThinking(true);
    void searchOutside(id, lastQuestion).finally(() => {
      if (mounted.current) setThinking(false);
    });
  };

  useEffect(() => {
    if (params.q && id && conv && conv.messages.length === 0) send(params.q);
    // Solo al abrir con una pregunta inicial (?q=…).
  }, [id, conv?.id]);

  const messages = conv?.messages ?? [];
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const suggestions = [
    { label: s.chat.suggestions[0], run: () => send(s.live.prompts[0] ?? '') },
    ...(PREVIEW
      ? [{ label: s.chat.suggestions[1], run: () => router.push('/study/quiz-setup') }]
      : []),
    { label: s.chat.suggestions[2], run: () => send(s.live.prompts[1] ?? '') },
  ];

  const renderMascot = (m: Message, isLast: boolean) => {
    switch (m.kind) {
      case 'answer':
        return (
          <MascotBubble
            key={m.id}
            sources={
              <>
                {(m.sources ?? []).map((src) => (
                  <Tap
                    key={`${src.documentId}-${src.page}`}
                    accessibilityRole="link"
                    onPress={() => router.push(`/documents/${src.documentId}`)}
                  >
                    <Chip label={s.chat.ownSource(src.page)} tone="primary" icon="file-text" />
                  </Tap>
                ))}
                {m.external ? (
                  <Chip label={s.chat.externalCount(1)} tone="external" icon="globe" />
                ) : null}
              </>
            }
          >
            <Text variant="small" selectable>
              {m.text}
            </Text>
          </MascotBubble>
        );
      case 'notFound':
        return (
          <MascotBubble key={m.id}>
            <Text variant="small">{s.chat.notFound}</Text>
            {isLast ? (
              <View style={styles.actions}>
                <Tap
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !externalOn }}
                  disabled={!externalOn || !id || thinking}
                  onPress={outside}
                  style={[
                    styles.pill,
                    { backgroundColor: c.external, opacity: externalOn ? 1 : 0.5 },
                  ]}
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
            ) : null}
          </MascotBubble>
        );
      case 'external':
        return (
          <Card key={m.id} tone="external" style={{ backgroundColor: c.externalSoft }}>
            <View style={styles.row}>
              <Icon name="globe" size={14} color="external" />
              <Text variant="smallStrong" color="external" accessibilityRole="header">
                {s.chat.externalAnswer}
              </Text>
            </View>
            <Text variant="small">{m.text || s.live.externalEmpty}</Text>
            {m.external ? (
              <Tap
                accessibilityRole="link"
                accessibilityLabel={`${m.external.title}, ${m.external.host}`}
                onPress={() =>
                  m.external && void Linking.openURL(m.external.url ?? `https://${m.external.host}`)
                }
                style={[styles.source, { backgroundColor: c.surface }]}
              >
                <View style={styles.flex}>
                  <Text variant="smallStrong">{m.external.title}</Text>
                  <Text variant="caption" color="external">
                    {m.external.host}
                  </Text>
                </View>
                <Icon name="external-link" size={14} color="external" />
              </Tap>
            ) : null}
            <Text variant="caption" color="textMuted">
              {s.chat.externalDisclaimer}
            </Text>
          </Card>
        );
      case 'limit':
        return (
          <Banner key={m.id} tone="warning" icon="clock" title={s.errors.CHAT_DAILY_LIMIT}>
            <Text variant="caption">{s.chat.limitBody(asked, limit, 'la medianoche')}</Text>
            <ProgressBar value={1} tone="accent" label={s.errors.CHAT_DAILY_LIMIT} />
            {plan === 'free' ? (
              <Button label={s.chat.seePlans} onPress={() => router.push('/plans')} />
            ) : null}
          </Banner>
        );
      case 'error':
        return (
          <Banner key={m.id} tone="danger" title={s.chat.failedTitle} body={s.errors.CHAT_FAILED}>
            <TextLink label={s.chat.retry} color="danger" onPress={() => send(lastQuestion)} />
          </Banner>
        );
      default:
        return (
          <MascotBubble key={m.id}>
            <Text variant="small">{m.text}</Text>
          </MascotBubble>
        );
    }
  };

  return (
    <ChatScreen
      subtitle={s.chat.knows(courseCount)}
      composer={
        <>
          {messages.length === 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((sg) => (
                <Tap
                  key={sg.label}
                  accessibilityRole="button"
                  onPress={sg.run}
                  style={[styles.suggestion, { borderColor: c.border, backgroundColor: c.surface }]}
                >
                  <Text variant="smallStrong" color="primary">
                    {sg.label}
                  </Text>
                </Tap>
              ))}
            </View>
          ) : null}
          <Composer
            placeholder={thinking ? s.chat.placeholderShort : s.chat.placeholder}
            busy={thinking}
            value={draft}
            onChangeText={setDraft}
            onSend={() => send(draft)}
          />
        </>
      }
    >
      {messages.length === 0 ? <MascotStage label={s.chat.animated} /> : null}
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <UserBubble key={m.id} text={m.text} />
        ) : (
          renderMascot(m, i === messages.length - 1)
        ),
      )}
      {thinking ? (
        <>
          <View style={styles.center}>
            <Mascot size={72} mood="curious" />
          </View>
          <MascotBubble>
            <View style={styles.row} accessibilityLiveRegion="polite">
              <Icon name="refresh-cw" size={14} color="primary" />
              <Text variant="smallStrong" color="primary">
                {s.chat.searching}
              </Text>
            </View>
            {[0.95, 0.8, 0.6].map((w) => (
              <View
                key={w}
                style={[styles.skeleton, { width: `${w * 100}%`, backgroundColor: c.surfaceAlt }]}
              />
            ))}
          </MascotBubble>
        </>
      ) : null}
    </ChatScreen>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  suggestion: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
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
  center: { alignItems: 'center' },
  skeleton: { height: 8, borderRadius: 4, minWidth: 180 },
});
