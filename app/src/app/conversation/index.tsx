import { AnswerClaims } from '@/components/chat/AnswerClaims';
import { progressPhase } from '@/components/chat/progress';
import { openSourcePage } from '@/lib/source-page';
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
import { OfflineBanner } from '@/components/domain/OfflineBanner';
import { useStrings } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import { useOnline } from '@/lib/online';
import {
  answerQuestion,
  askQuestion,
  cancelAnswer,
  dailyQuestionLimit,
  editLastQuestion,
  questionsToday,
  retryConversationSync,
  retryLastQuestion,
  searchOutside,
  startConversation,
  useStore,
  widenConversationScope,
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
  const params = useLocalSearchParams<{ id?: string; q?: string; docs?: string }>();
  const [id, setId] = useState<string | null>(params.id ?? null);
  const conv = useStore((st) => st.conversations.find((cv) => cv.id === id));
  const courseCount = useStore((st) => st.courses.length);
  const externalOn = useStore((st) => st.settings.external);
  const asked = useStore(questionsToday);
  const limit = useStore(dailyQuestionLimit);
  // La respuesta en camino vive en el store: sigue visible al salir y volver al chat.
  const pending = useStore((st) => (id ? st.pendingAnswers[id] : undefined));
  const thinking = pending !== undefined;
  const [draft, setDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const initialSent = useRef(false);
  const online = useOnline();

  // Al volver la conexión se sube lo que quedó guardado solo en el dispositivo.
  useEffect(() => {
    if (online) retryConversationSync();
  }, [online]);

  useEffect(() => {
    if (!id) {
      const scope = (params.docs ?? '').split(',').filter((d) => d.length > 0);
      setId(startConversation(scope));
    }
  }, [id]);
  const scopeNames = useStore((st) =>
    (st.conversations.find((cv) => cv.id === id)?.scopeDocIds ?? []).map(
      (docId) => st.documents.find((d) => d.id === docId)?.name ?? '',
    ),
  );
  const scoped = (conv?.scopeDocIds?.length ?? 0) > 0;

  // Reloj de los avisos de progreso: solo corre mientras hay una respuesta en camino.
  const startedAt = pending?.startedAt;
  useEffect(() => {
    if (startedAt === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const send = (text: string) => {
    // Con una respuesta en camino no se envía: el borrador se conserva.
    if (!id || thinking || text.trim().length === 0) return;
    // Sin conexión la pregunta espera como borrador (sugerencias y reintentos incluidos).
    if (!online) {
      setDraft(text);
      return;
    }
    setDraft('');
    if (!askQuestion(id, text)) return; // límite diario: el mensaje queda con el aviso
    void answerQuestion(id, text);
  };
  const outside = () => {
    if (!id || thinking || !online) return;
    void searchOutside(id, lastQuestion);
  };
  const stop = () => {
    if (id) cancelAnswer(id);
  };
  const retry = () => {
    if (id && !thinking) retryLastQuestion(id);
  };
  const edit = () => {
    if (!id || thinking) return;
    const text = editLastQuestion(id);
    if (text !== null) setDraft(text);
  };

  useEffect(() => {
    // Solo una vez, al abrir con una pregunta inicial (?q=…).
    if (initialSent.current || !params.q || !id || !conv || conv.messages.length > 0) return;
    initialSent.current = true;
    send(params.q);
  }, [id, conv?.id]);

  const messages = conv?.messages ?? [];
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
  /** Pregunta del estudiante que precede al mensaje `index` (para citarla en el aviso). */
  const questionBefore = (index: number): string =>
    messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === 'user')?.text ?? '';
  const errorText = (code: Message['errorCode']): string => {
    switch (code) {
      case 'TIMEOUT':
        return s.chat.errorTimeout;
      case 'NETWORK':
        return s.chat.errorNetwork;
      case 'RATE_LIMITED':
        return s.chat.errorRateLimited;
      default:
        return s.errors.CHAT_FAILED;
    }
  };
  const phase = progressPhase(startedAt === undefined ? 0 : now - startedAt);
  const progressText =
    phase === 'slow'
      ? s.chat.searchingSlow
      : phase === 'longer'
        ? s.chat.searchingLonger
        : pending?.kind === 'external'
          ? s.chat.searchingExternal
          : s.chat.searching;
  const suggestions = [
    { label: s.chat.suggestions[0], run: () => send(s.live.prompts[0] ?? '') },
    ...(PREVIEW
      ? [{ label: s.chat.suggestions[1], run: () => router.push('/study/quiz-setup') }]
      : []),
    { label: s.chat.suggestions[2], run: () => send(s.live.prompts[1] ?? '') },
  ];

  const renderMascot = (m: Message, index: number) => {
    const isLast = index === messages.length - 1;
    switch (m.kind) {
      case 'answer':
        return (
          <MascotBubble
            key={m.id}
            sources={
              <>
                {m.claims
                  ? null
                  : (m.sources ?? []).map((src) => (
                      <Tap
                        key={`${src.documentId}-${src.page}`}
                        accessibilityRole="link"
                        accessibilityLabel={s.chat.checkPage(src.page)}
                        onPress={() => void openSourcePage(src.documentId, src.page)}
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
            {m.claims ? (
              <AnswerClaims claims={m.claims} />
            ) : (
              <Text variant="small" selectable>
                {m.text}
              </Text>
            )}
          </MascotBubble>
        );
      case 'smallTalk':
        return (
          <MascotBubble key={m.id}>
            <Text variant="small">{s.chat.smallTalk[m.smallTalk ?? 'greeting']}</Text>
          </MascotBubble>
        );
      case 'notFound':
        if (m.unclear) {
          // Pregunta demasiado corta o ambigua: buscar fuera no ayudaría; basta con "Editar".
          return (
            <MascotBubble key={m.id}>
              <Text variant="small">{s.chat.notFoundUnclear(questionBefore(index))}</Text>
            </MascotBubble>
          );
        }
        return (
          <MascotBubble key={m.id}>
            <Text variant="small">
              {m.reason === 'validation_failed' ? s.chat.notFoundUnverified : s.chat.notFound}
            </Text>
            {isLast ? (
              <View style={styles.actions}>
                <Tap
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !externalOn }}
                  disabled={!externalOn || !id || thinking || !online}
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
            <Text variant="caption">{s.chat.limitUsed(asked, limit)}</Text>
            <ProgressBar value={1} tone="accent" label={s.errors.CHAT_DAILY_LIMIT} />
            <Text variant="caption">{s.chat.plansSoon}</Text>
          </Banner>
        );
      case 'error':
        return (
          <Banner key={m.id} tone="danger" title={s.chat.failedTitle} body={errorText(m.errorCode)}>
            {isLast && !thinking ? (
              <TextLink label={s.chat.retry} color="danger" onPress={retry} />
            ) : null}
          </Banner>
        );
      case 'cancelled':
        return (
          <View key={m.id} style={styles.cancelled}>
            <View style={styles.row}>
              <Mascot size={28} mood="sleepy" />
              <Text variant="caption" color="textMuted">
                {s.chat.cancelled}
              </Text>
            </View>
            {isLast && !thinking ? (
              <View style={styles.actions}>
                <TextLink label={s.chat.retry} variant="caption" onPress={retry} />
                <TextLink label={s.chat.editQuestion} variant="caption" onPress={edit} />
              </View>
            ) : null}
          </View>
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
          <OfflineBanner title={s.connection.chat} />
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
            sendBlocked={!online}
            value={draft}
            onChangeText={setDraft}
            onSend={() => send(draft)}
            onStop={stop}
            hint={thinking && draft.trim().length > 0 ? s.chat.pendingDraftHint : null}
          />
        </>
      }
    >
      {scoped ? (
        <View style={styles.row}>
          <Chip label={s.chat.scopeOnly(scopeNames.filter(Boolean).join(', '))} icon="file-text" />
          <Tap
            accessibilityRole="button"
            accessibilityLabel={s.chat.scopeWiden}
            disabled={thinking}
            onPress={() => id && widenConversationScope(id)}
            hitSlop={8}
          >
            <Icon name="x" size={16} color="textMuted" />
          </Tap>
        </View>
      ) : null}
      {messages.length === 0 ? <MascotStage label={s.chat.animated} /> : null}
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <View key={m.id} style={styles.userTurn}>
            <UserBubble text={m.text} />
            {i === lastUserIndex && !thinking ? (
              <TextLink label={s.chat.edit} variant="caption" color="textMuted" onPress={edit} />
            ) : null}
          </View>
        ) : (
          renderMascot(m, i)
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
                {progressText}
              </Text>
            </View>
            {phase === 'slow' ? (
              <TextLink label={s.chat.stop} color="danger" onPress={stop} />
            ) : null}
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
  userTurn: { alignSelf: 'stretch', alignItems: 'flex-end', gap: space.xs },
  cancelled: { alignSelf: 'flex-start', gap: space.xs },
  skeleton: { height: 8, borderRadius: 4, minWidth: 180 },
});
