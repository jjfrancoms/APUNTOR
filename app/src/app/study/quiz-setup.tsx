import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StudyError, StudyLoading } from '@/components/domain/StudyState';
import {
  Banner,
  Button,
  Card,
  Chip,
  ListRow,
  Mascot,
  Screen,
  SelectField,
  Segmented,
  Text,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { api, type ApiStudySet, type ApiUsage, type StudyKind } from '@/lib/api';
import { PREVIEW } from '@/lib/config';
import { useOnline } from '@/lib/online';
import {
  estimateMinutes,
  generationsLeft,
  isCancelled,
  STUDY_COUNTS,
  toStudyError,
  type StudyCount,
  type StudyErrorCode,
} from '@/lib/study';
import { previewSet } from '@/lib/study-preview';
import { useStore } from '@/store/store';
import { radius, space, useTheme } from '@/theme';

/** Ruta de cada tipo de juego. */
function routeFor(kind: StudyKind): '/study/quiz' | '/study/flashcards' {
  return kind === 'quiz' ? '/study/quiz' : '/study/flashcards';
}

/**
 * Pantalla 31 · Configurar un quiz o un juego de tarjetas: documento (o tema, si se llega con
 * `doc` y `topic`), tipo y cantidad. Muestra el uso diario, un mensaje claro por cada error y los
 * juegos ya generados, para reabrirlos sin gastar cupo. `?demo=loading|error|offline`.
 */
export default function QuizSetup() {
  const s = useStrings();
  const { c } = useTheme();
  const q = s.quizSetup;
  const st = s.study;
  const params = useLocalSearchParams<{
    doc?: string;
    topic?: string;
    topicTitle?: string;
    kind?: string;
    demo?: string;
  }>();
  const online = useOnline();
  const documents = useStore((state) => state.documents).filter((d) => d.status === 'completed');
  const [docId, setDocId] = useState<string | undefined>(params.doc);
  const [kind, setKind] = useState<StudyKind>(params.kind === 'cards' ? 'cards' : 'quiz');
  const [amount, setAmount] = useState<StudyCount>('10');
  const [topicId, setTopicId] = useState<string | undefined>(params.topic);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [saved, setSaved] = useState<ApiStudySet[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<StudyErrorCode | null>(null);
  const controller = useRef<AbortController | null>(null);

  const selectedDoc = docId ?? documents[0]?.id;

  useEffect(() => {
    if (PREVIEW) {
      setUsage({
        questionsToday: 0,
        questionsLimit: 50,
        storageBytes: 0,
        storageLimit: 1,
        studyGenerationsToday: 3,
        studyGenerationsLimit: 10,
      });
      setSaved([previewSet('quiz').set, previewSet('cards').set]);
      return;
    }
    api.usage().then(setUsage, () => setUsage(null));
  }, []);

  useEffect(() => {
    if (PREVIEW || !selectedDoc) return;
    let active = true;
    api.studySets({ documentId: selectedDoc }).then(
      ({ sets }) => active && setSaved(sets),
      () => active && setSaved([]),
    );
    return () => {
      active = false;
    };
  }, [selectedDoc]);

  useEffect(() => () => controller.current?.abort(), []);

  const generate = useCallback(async () => {
    if (!selectedDoc) return;
    setError(null);
    if (PREVIEW) {
      router.replace({ pathname: routeFor(kind), params: { setId: `demo-${kind}` } });
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setGenerating(true);
    try {
      const { set } = await api.createStudySet(
        { documentId: selectedDoc, kind, count: Number(amount), ...(topicId ? { topicId } : {}) },
        { signal: abort.signal },
      );
      router.replace({ pathname: routeFor(set.kind), params: { setId: set.id } });
    } catch (e: unknown) {
      if (!isCancelled(e)) setError(toStudyError(e));
    } finally {
      setGenerating(false);
    }
  }, [selectedDoc, kind, amount, topicId]);

  const left = usage
    ? generationsLeft(usage.studyGenerationsToday, usage.studyGenerationsLimit)
    : null;
  const limitReached = left === 0;
  const count = Number(amount);
  const demoState = params.demo;

  if (demoState === 'loading' || generating) {
    return (
      <Screen
        header={<TopBar icon="x" title={q.header} />}
        footer={
          generating ? (
            <Button
              label={st.cancel}
              variant="secondary"
              onPress={() => controller.current?.abort()}
            />
          ) : null
        }
      >
        <StudyLoading title={st.generating} hint={st.generatingHint} />
      </Screen>
    );
  }
  if (demoState === 'offline' || demoState === 'error') {
    return (
      <Screen header={<TopBar icon="x" title={q.header} />}>
        <StudyError
          code={demoState === 'offline' ? 'NET' : 'GENERIC'}
          onRetry={() => router.setParams({ demo: '' })}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<TopBar icon="x" title={q.header} />}
      footer={
        <Button
          label={st.generate}
          disabled={!selectedDoc || limitReached || !online}
          onPress={() => void generate()}
        />
      }
    >
      <View style={styles.bubbleRow}>
        <Mascot size={64} />
        <View style={[styles.bubble, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text variant="smallStrong">{q.mascot}</Text>
        </View>
      </View>
      {!online ? <Banner tone="warning" icon="wifi-off" title={st.offlineBody} /> : null}
      {error ? <Banner tone="danger" icon="alert-circle" title={st.errors[error]} /> : null}
      {usage ? (
        <View style={styles.chips}>
          <Chip
            label={st.usage(usage.studyGenerationsToday, usage.studyGenerationsLimit)}
            tone={limitReached ? 'danger' : 'primary'}
          />
          {left !== null && !limitReached ? <Chip label={st.usageLeft(left)} /> : null}
        </View>
      ) : null}
      {limitReached ? (
        <Banner tone="warning" icon="clock" title={st.errors.STUDY_DAILY_LIMIT} />
      ) : null}
      {documents.length === 0 ? (
        <Card>
          <Text variant="bodyStrong">{st.noDocumentsTitle}</Text>
          <Text variant="small" color="textMuted">
            {st.noDocumentsBody}
          </Text>
        </Card>
      ) : (
        <>
          <Text variant="smallStrong" accessibilityRole="header">
            {st.document}
          </Text>
          <SelectField
            value={documents.find((d) => d.id === selectedDoc)?.name}
            placeholder={st.documentPlaceholder}
            options={documents.map((d) => ({ value: d.id, label: d.name }))}
            selected={selectedDoc}
            onSelect={(id) => {
              setDocId(id);
              setTopicId(undefined);
            }}
          />
          {topicId ? (
            <Chip label={st.topicOnly(params.topicTitle ?? '')} tone="primary" icon="book-open" />
          ) : null}
        </>
      )}
      <Text variant="smallStrong" accessibilityRole="header">
        {st.kindLabel}
      </Text>
      <Segmented
        options={[
          { value: 'quiz' as StudyKind, label: st.kindQuiz },
          { value: 'cards' as StudyKind, label: st.kindCards },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Text variant="smallStrong" accessibilityRole="header">
        {kind === 'quiz' ? st.amountQuiz : st.amountCards}
      </Text>
      <Segmented
        options={STUDY_COUNTS.map((a) => ({ value: a, label: a }))}
        value={amount}
        onChange={setAmount}
      />
      <View style={styles.chips}>
        <Chip label={q.minutes(estimateMinutes(count))} icon="clock" />
      </View>
      {saved.length > 0 ? (
        <>
          <Text variant="overline" color="textMuted">
            {st.savedTitle}
          </Text>
          <Text variant="caption" color="textMuted">
            {st.savedHint}
          </Text>
          <Card style={styles.list}>
            {saved.map((set, i) => (
              <ListRow
                key={set.id}
                title={`${st.savedKind[set.kind]} · ${set.topicTitle ?? set.documentTitle}`}
                detail={
                  set.lastScore !== null && set.lastTotal !== null
                    ? `${st.savedRow(set.itemCount)} · ${st.savedScore(set.lastScore, set.lastTotal)}`
                    : st.savedRow(set.itemCount)
                }
                divider={i < saved.length - 1}
                onPress={() =>
                  router.push({ pathname: routeFor(set.kind), params: { setId: set.id } })
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bubble: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { padding: 0, gap: 0 },
});
