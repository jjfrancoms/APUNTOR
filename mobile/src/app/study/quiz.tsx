import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Icon,
  Mascot,
  ProgressBar,
  Screen,
  Text,
  TopBar,
} from '@/components/ui';
import { quizQuestions, quizSession } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { recordQuiz } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme';

const LETTERS = ['A', 'B', 'C', 'D'];

/** Pantalla 21 · Quiz. Cada respuesta marca la correcta y cita la página de tus apuntes. */
export default function Quiz() {
  const s = useStrings();
  const { c } = useTheme();
  const { n } = useLocalSearchParams<{ n?: string }>();
  const total = [5, 10, 20].includes(Number(n)) ? Number(n) : 10;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  // Banco de ejemplo: se recorre en orden; con más preguntas que el banco, se repite.
  const q = quizQuestions[index % quizQuestions.length];
  if (!q) return null;
  const answered = selected !== null;
  const last = index === total - 1;

  const choose = (i: number) => {
    setSelected(i);
    if (i === q.answer) setScore((v) => v + 1);
  };
  const next = () => {
    if (last) {
      recordQuiz(score, total);
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  };

  if (finished) {
    return (
      <Screen
        header={
          <TopBar
            icon="x"
            title={s.quiz.header(quizSession.topic)}
            onBack={() => router.replace('/home')}
          />
        }
        footer={
          <>
            <Button
              label={s.quiz.toFlashcards}
              onPress={() => router.replace('/study/flashcards')}
            />
            <Button
              label={s.empty.backHome}
              variant="secondary"
              onPress={() => router.replace('/home')}
            />
          </>
        }
      >
        <View style={styles.result}>
          <Mascot size={110} mood={score / total >= 0.6 ? 'sparkle' : 'curious'} halo />
          <Text variant="title" align="center" accessibilityRole="header">
            {s.demo.quizDone}
          </Text>
          <Text variant="heading" color="primary" align="center">
            {s.demo.quizResult(score, total)}
          </Text>
          <ProgressBar value={score / total} label={s.demo.quizResult(score, total)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <TopBar
          icon="x"
          title={s.quiz.header(quizSession.topic)}
          subtitle={quizSession.location}
          right={<Chip label={s.quiz.counter(index + 1, total)} tone="primary" />}
        />
      }
      footer={
        <Button label={last ? s.quiz.finish : s.quiz.next} disabled={!answered} onPress={next} />
      }
    >
      <ProgressBar
        value={(index + (answered ? 1 : 0)) / total}
        label={s.quiz.progress(index + 1, total)}
      />
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
              onPress={() => choose(i)}
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
  result: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
