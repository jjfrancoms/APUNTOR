import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Icon, ProgressBar, Screen, Text, TopBar } from '@/components/ui';
import { quizQuestions, quizSession } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Pantalla 21 · Quiz. Al responder se marca la correcta y se cita la página de tus apuntes. */
export default function Quiz() {
  const s = useStrings();
  const { c } = useTheme();
  const [index, setIndex] = useState(0);
  // El diseño muestra la pregunta ya respondida (C incorrecta) para enseñar ambos estados.
  const [selected, setSelected] = useState<number | null>(2);
  const q = quizQuestions[index];
  if (!q) return null;
  const n = quizSession.current + index;
  const answered = selected !== null;
  const last = index === quizQuestions.length - 1;
  const next = () => {
    if (last) return router.replace('/study/flashcards');
    setIndex(index + 1);
    setSelected(null);
  };
  return (
    <Screen
      header={
        <TopBar
          icon="x"
          title={s.quiz.header(quizSession.topic)}
          subtitle={quizSession.location}
          right={<Chip label={s.quiz.counter(n, quizSession.total)} tone="primary" />}
        />
      }
      footer={
        <Button label={last ? s.quiz.finish : s.quiz.next} disabled={!answered} onPress={next} />
      }
    >
      <ProgressBar value={n / quizSession.total} label={s.quiz.progress(n, quizSession.total)} />
      <Text variant="heading" accessibilityRole="header">
        {q.prompt}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {q.options.map((opt, i) => {
          const right = answered && i === q.answer;
          const wrong = answered && i === selected && i !== q.answer;
          const border = right ? c.primary : wrong ? c.danger : c.border;
          const bg = right ? c.primarySoft : wrong ? c.dangerSoft : c.surface;
          const label = right ? s.quiz.correct : wrong ? s.quiz.incorrect : '';
          return (
            <Pressable
              key={opt}
              accessibilityRole="radio"
              accessibilityLabel={`${LETTERS[i] ?? ''}. ${opt}${label ? `. ${label}` : ''}`}
              accessibilityState={{ selected: selected === i, disabled: answered }}
              disabled={answered}
              onPress={() => setSelected(i)}
              style={[styles.option, { borderColor: border, backgroundColor: bg }]}
            >
              <View
                style={[
                  styles.letter,
                  { backgroundColor: right ? c.primary : wrong ? c.danger : c.surfaceAlt },
                ]}
              >
                {right ? (
                  <Icon name="check" size={14} color="onPrimary" />
                ) : wrong ? (
                  <Icon name="x" size={14} color="onPrimary" />
                ) : (
                  <Text variant="caption">{LETTERS[i] ?? ''}</Text>
                )}
              </View>
              <Text
                variant="small"
                color={right ? 'primary' : wrong ? 'danger' : 'text'}
                style={styles.flex}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {answered ? (
        <Card tone="primary">
          <Chip label={s.quiz.source(q.klass, q.page)} tone="primary" icon="file-text" />
          <Text variant="small">{q.explanation}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: layout.minTouchTarget + 8,
  },
  letter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
