import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Icon, ProgressBar, Screen, Text, TopBar } from '@/components/ui';
import { flashcards, flashcardSession } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';

/** Pantalla 22 · Flashcards con repetición espaciada: "Aún no lo sé" vuelve antes; "Lo sé", después. */
export default function Flashcards() {
  const s = useStrings();
  const { c } = useTheme();
  const f = s.flashcards;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = flashcards[index];
  if (!card) return null;
  const n = flashcardSession.current + index;
  const grade = () => {
    if (index === flashcards.length - 1) return router.replace('/home');
    setIndex(index + 1);
    setFlipped(false);
  };
  return (
    <Screen
      header={
        <TopBar
          icon="x"
          title={f.header}
          subtitle={flashcardSession.location}
          right={<Chip label={f.counter(n, flashcardSession.total)} tone="primary" />}
        />
      }
      footer={
        <View style={styles.grades}>
          <View style={styles.flex}>
            <Button label={f.notYet} variant="dangerOutline" icon="x" onPress={grade} />
          </View>
          <View style={styles.flex}>
            <Button label={f.know} icon="check" onPress={grade} />
          </View>
        </View>
      }
    >
      <ProgressBar
        value={n / flashcardSession.total}
        label={f.counter(n, flashcardSession.total)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityHint={flipped ? f.tapToReturn : f.tapToFlip}
        onPress={() => setFlipped(!flipped)}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Chip label={flipped ? f.answer : f.term} tone="primary" />
        <Text variant={flipped ? 'body' : 'title'} align="center">
          {flipped ? card.back : card.front}
        </Text>
        <View style={styles.hint}>
          <Icon name="refresh-cw" size={12} color="textMuted" />
          <Text variant="caption" color="textMuted">
            {flipped ? f.tapToReturn : f.tapToFlip}
          </Text>
        </View>
      </Pressable>
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
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grades: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
});
