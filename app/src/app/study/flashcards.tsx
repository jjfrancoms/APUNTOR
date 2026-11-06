import { previewOnly } from '@/components/domain/PreviewOnly';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Chip,
  Icon,
  Mascot,
  ProgressBar,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { answerCard, knownFirstTry, learnedCount, startSession } from '@/lib/flashcards';
import { flashcards, flashcardSession } from '@/data/mock';
import { gradeCard } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/**
 * Pantalla 22 · Flashcards con repetición espaciada (lib/flashcards.ts).
 * Primero piensas la respuesta y giras la tarjeta; solo entonces te calificas:
 * "Aún no lo sé" la devuelve al final de este repaso y a mañana; "Lo sé" la saca del repaso
 * y la agenda dentro de más días.
 */
function Flashcards() {
  const s = useStrings();
  const { c } = useTheme();
  const f = s.flashcards;
  const [session, setSession] = useState(() => startSession(flashcards.map((x) => x.id)));
  const [flipped, setFlipped] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const currentId = session.queue[0];
  const card = flashcards.find((x) => x.id === currentId);
  const total = session.total;
  const learned = learnedCount(session);
  // Si ya se respondió antes en esta sesión, es una tarjeta que volvió por "Aún no lo sé".
  const repeated = currentId !== undefined && currentId in session.firstTry;
  const grade = (isKnown: boolean) => {
    if (!card) return;
    gradeCard(card.id, isKnown);
    setSession((prev) => answerCard(prev, isKnown));
    setFlipped(false);
  };
  if (!card) {
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
          subtitle={flashcardSession.location}
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
        <Chip label={s.quiz.source(card.klass, card.page)} tone="primary" icon="file-text" />
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

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(Flashcards);
