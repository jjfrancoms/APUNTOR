import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CitationChip } from '@/components/domain/CitationChip';
import { StudyError, StudyLoading } from '@/components/domain/StudyState';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Mascot,
  ProgressBar,
  Screen,
  Text,
  TopBar,
} from '@/components/ui';
import { Tap } from '@/components/ui/Tap';
import { useStrings } from '@/i18n/es';
import { api, type ApiStudyItem } from '@/lib/api';
import { PREVIEW } from '@/lib/config';
import { previewSet } from '@/lib/study-preview';
import { useStudyLoad } from '@/lib/use-study-load';
import { layout, radius, space, useTheme } from '@/theme';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Pantalla 21 · Quiz del servidor (`?setId=`). Cada respuesta marca la correcta, explica y cita la
 * página de tus apuntes (se abre al tocarla). Al terminar se envía el resultado.
 * `?demo=loading|error|offline|empty` muestra cada estado.
 */
export default function Quiz() {
  const s = useStrings();
  const { setId, demo } = useLocalSearchParams<{ setId?: string; demo?: string }>();
  const fetcher = useCallback(
    () => (PREVIEW ? Promise.resolve(previewSet('quiz')) : api.studySet(setId ?? '')),
    [setId],
  );
  const { load, reload } = useStudyLoad(fetcher, demo);
  const back = <TopBar icon="x" title={s.study.quizTitle} />;
  if (load.state === 'loading') {
    return (
      <Screen header={back}>
        <StudyLoading />
      </Screen>
    );
  }
  if (load.state === 'error') {
    return (
      <Screen header={back}>
        <StudyError code={load.code} onRetry={reload} />
      </Screen>
    );
  }
  const questions = demo === 'empty' ? [] : load.data.items.filter((i) => i.kind === 'quiz');
  if (questions.length === 0) {
    return (
      <Screen header={back}>
        <EmptyState
          mood="curious"
          title={s.study.emptySetTitle}
          body={s.study.emptySetBody}
          primary={{ label: s.common.back, onPress: () => router.back() }}
        />
      </Screen>
    );
  }
  return (
    <QuizPlay
      setId={load.data.set.id}
      title={load.data.set.topicTitle ?? load.data.set.documentTitle}
      items={questions}
    />
  );
}

function QuizPlay({
  setId,
  title,
  items,
}: {
  setId: string;
  title: string;
  items: ApiStudyItem[];
}) {
  const s = useStrings();
  const { c } = useTheme();
  const total = items.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const q = items[index];
  if (!q || q.kind !== 'quiz') return null;
  const answered = selected !== null;
  const last = index === total - 1;

  const choose = (i: number) => {
    setSelected(i);
    if (i === q.correctIndex) setScore((v) => v + 1);
  };
  const next = () => {
    if (last) {
      setFinished(true);
      if (!PREVIEW) {
        api.saveStudyResult(setId, { score, total }).catch(() => setSaveFailed(true));
      }
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  };

  if (finished) {
    return (
      <Screen
        header={
          <TopBar icon="x" title={s.quiz.header(title)} onBack={() => router.replace('/home')} />
        }
        footer={
          <>
            <Button label={s.quiz.toFlashcards} onPress={() => router.replace('/study/review')} />
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
          {saveFailed ? (
            <Banner tone="warning" icon="alert-circle" title={s.study.resultNotSaved} />
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <TopBar
          icon="x"
          title={s.quiz.header(title)}
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
        {q.question}
      </Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {q.options.map((opt, i) => {
          const right = answered && i === q.correctIndex;
          const wrong = answered && i === selected && i !== q.correctIndex;
          const border = right ? c.primary : wrong ? c.danger : c.border;
          const bg = right ? c.primarySoft : wrong ? c.dangerSoft : c.surface;
          const label = right ? s.quiz.correct : wrong ? s.quiz.incorrect : '';
          return (
            <Tap
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
            </Tap>
          );
        })}
      </View>
      {answered ? (
        <Card tone="primary">
          <CitationChip citation={q.citation} />
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
