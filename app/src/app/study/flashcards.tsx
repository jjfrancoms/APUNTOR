import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CitationChip } from '@/components/domain/CitationChip';
import { StudyError, StudyLoading } from '@/components/domain/StudyState';
import {
  Banner,
  Button,
  Chip,
  EmptyState,
  Icon,
  Mascot,
  ProgressBar,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { Tap } from '@/components/ui/Tap';
import { useStrings } from '@/i18n/es';
import { api, type ApiStudyItem } from '@/lib/api';
import { PREVIEW } from '@/lib/config';
import { answerCard, knownFirstTry, learnedCount, startSession } from '@/lib/flashcards';
import { cardFace } from '@/lib/study';
import { previewReview, previewSet } from '@/lib/study-preview';
import { useStudyLoad } from '@/lib/use-study-load';
import { radius, space, useTheme } from '@/theme';

/**
 * Pantalla 22 · Flashcards con repetición espaciada del servidor. Se abre con `?setId=` (un juego
 * guardado) o con `?review=1` (las de hoy). Primero piensas la respuesta y giras la tarjeta; solo
 * entonces te calificas: cada respuesta se envía al servidor, que agenda la próxima vez.
 * `?demo=loading|error|offline|empty` muestra cada estado.
 */
export default function Flashcards() {
  const s = useStrings();
  const { setId, review, demo } = useLocalSearchParams<{
    setId?: string;
    review?: string;
    demo?: string;
  }>();
  const fetcher = useCallback(async (): Promise<{ title: string; items: ApiStudyItem[] }> => {
    if (review === '1') {
      const { items } = PREVIEW ? { items: previewReview() } : await api.reviewToday();
      return { title: s.dailyReview.header, items };
    }
    const { set, items } = PREVIEW ? previewSet('cards') : await api.studySet(setId ?? '');
    return { title: set.topicTitle ?? set.documentTitle, items };
  }, [review, setId, s.dailyReview.header]);
  const { load, reload } = useStudyLoad(fetcher, demo);
  const top = <TopBar icon="x" title={s.flashcards.header} />;
  if (load.state === 'loading') {
    return (
      <Screen header={top}>
        <StudyLoading />
      </Screen>
    );
  }
  if (load.state === 'error') {
    return (
      <Screen header={top}>
        <StudyError code={load.code} onRetry={reload} />
      </Screen>
    );
  }
  const items = demo === 'empty' ? [] : load.data.items;
  if (items.length === 0) {
    return (
      <Screen header={top}>
        <EmptyState
          mood="curious"
          title={s.study.emptySetTitle}
          body={s.study.emptySetBody}
          primary={{ label: s.common.back, onPress: () => router.back() }}
        />
      </Screen>
    );
  }
  return <FlashcardsPlay title={load.data.title} items={items} />;
}

function FlashcardsPlay({ title, items }: { title: string; items: ApiStudyItem[] }) {
  const s = useStrings();
  const { c } = useTheme();
  const f = s.flashcards;
  const [session, setSession] = useState(() => startSession(items.map((x) => x.id)));
  const [flipped, setFlipped] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const currentId = session.queue[0];
  const item = items.find((x) => x.id === currentId);
  const card = item ? cardFace(item) : undefined;
  const total = session.total;
  const learned = learnedCount(session);
  // Si ya se respondió antes en esta sesión, es una tarjeta que volvió por "Aún no lo sé".
  const repeated = currentId !== undefined && currentId in session.firstTry;
  const grade = (isKnown: boolean) => {
    if (!item) return;
    if (!PREVIEW) {
      api
        .reviewStudyItem(item.id, isKnown)
        .then(() => setSaveFailed(false))
        .catch(() => setSaveFailed(true));
    }
    setSession((prev) => answerCard(prev, isKnown));
    setFlipped(false);
  };
  if (!item || !card) {
    return (
      <Screen
        header={<TopBar icon="x" title={f.header} onBack={() => router.replace('/home')} />}
        footer={<Button label={s.empty.backHome} onPress={() => router.replace('/home')} />}
      >
        <View style={styles.done}>
          <Mascot size={110} mood="sparkle" halo />
          <Text variant="title" align="center" accessibilityRole="header">
            {s.demo.cardsDone}
          </Text>
          <Text variant="heading" color="primary" align="center">
            {s.demo.cardsResult(knownFirstTry(session), total)}
          </Text>
          <Text variant="small" color="textMuted" align="center">
            {f.doneDetail}
          </Text>
        </View>
      </Screen>
    );
  }
  return (
    <Screen
      header={
        <TopBar
          icon="x"
          title={f.header}
          subtitle={title}
          right={<Chip label={f.counter(learned, total)} tone="primary" />}
        />
      }
      footer={
        flipped ? (
          <View style={styles.grades}>
            <View style={styles.flex}>
              <Button
                label={f.notYet}
                variant="dangerOutline"
                icon="x"
                onPress={() => grade(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button label={f.know} icon="check" onPress={() => grade(true)} />
            </View>
          </View>
        ) : (
          <Button label={f.reveal} icon="refresh-cw" onPress={() => setFlipped(true)} />
        )
      }
    >
      {saveFailed ? (
        <Banner tone="warning" icon="alert-circle" title={s.study.reviewNotSaved} />
      ) : null}
      <ProgressBar value={learned / total} label={f.learned(learned, total)} />
      <View style={styles.row}>
        {repeated ? <Chip label={f.again} tone="warning" icon="rotate-ccw" /> : <View />}
        <TextLink label={f.howTitle} onPress={() => setShowHow((v) => !v)} />
      </View>
      {showHow ? <Banner tone="info" icon="info" title={f.how} /> : null}
      <Tap
        accessibilityRole="button"
        accessibilityHint={flipped ? f.tapToReturn : f.tapToFlip}
        onPress={() => setFlipped(!flipped)}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        {flipped ? (
          <>
            <Text variant="smallStrong" color="textMuted" align="center">
              {card.front}
            </Text>
            <Text variant="subheading" align="center">
              {card.back}
            </Text>
          </>
        ) : (
          <Text variant="title" align="center">
            {card.front}
          </Text>
        )}
        <View style={styles.hint}>
          <Icon name="refresh-cw" size={12} color="textMuted" />
          <Text variant="caption" color="textMuted">
            {flipped ? f.tapToReturn : f.tapToFlip}
          </Text>
        </View>
      </Tap>
      <View style={styles.center}>
        <CitationChip citation={item.citation} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 380,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grades: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
