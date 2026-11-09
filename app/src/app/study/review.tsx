import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { StudyError, StudyLoading } from '@/components/domain/StudyState';
import { Button, Card, EmptyState, Icon, ListRow, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { api } from '@/lib/api';
import { PREVIEW } from '@/lib/config';
import { estimateMinutes, reviewByCourse } from '@/lib/study';
import { previewReview } from '@/lib/study-preview';
import { useStudyLoad } from '@/lib/use-study-load';
import { space } from '@/theme';

/**
 * Pantallas 32 y 46 · Repaso del día con las tarjetas que el servidor agenda para hoy; sin ellas
 * se muestra el estado vacío (46). `?demo=loading|error|offline|empty` muestra cada estado.
 */
export default function DailyReview() {
  const s = useStrings();
  const r = s.dailyReview;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const fetcher = useCallback(
    async () => (PREVIEW ? previewReview() : (await api.reviewToday()).items),
    [],
  );
  const { load, reload } = useStudyLoad(fetcher, demo);
  if (load.state === 'loading') {
    return (
      <Screen header={<TopBar title={r.header} />}>
        <StudyLoading />
      </Screen>
    );
  }
  if (load.state === 'error') {
    return (
      <Screen header={<TopBar title={r.header} />}>
        <StudyError code={load.code} onRetry={reload} />
      </Screen>
    );
  }
  const items = demo === 'empty' ? [] : load.data;
  if (items.length === 0) {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {r.title}
        </Text>
        <EmptyState
          mood="sparkle"
          title={s.empty.reviewTitle}
          body={s.empty.reviewBody}
          primary={{ label: s.empty.backHome, onPress: () => router.replace('/home') }}
          secondary={{ label: s.empty.doQuiz, onPress: () => router.push('/study/quiz-setup') }}
        />
      </Screen>
    );
  }
  const rows = reviewByCourse(items);
  const start = () => router.push({ pathname: '/study/flashcards', params: { review: '1' } });
  return (
    <Screen
      header={<TopBar title={r.header} />}
      footer={
        <>
          <Button label={r.start} onPress={start} />
          <Button label={r.later} variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <Card tone="primary" style={styles.hero}>
        <Text variant="display" color="primary" style={styles.big}>
          {String(items.length)}
        </Text>
        <Text variant="bodyStrong">{r.cardsToday}</Text>
        <Text variant="caption" color="textMuted">
          {r.minutes(estimateMinutes(items.length))}
        </Text>
      </Card>
      <Text variant="overline" color="textMuted">
        {r.byCourse}
      </Text>
      <Card style={styles.list}>
        {rows.map((row, i) => (
          <ListRow
            key={row.course ?? 'none'}
            title={row.course ?? s.study.unassignedCourse}
            detail={r.cards(row.cards)}
            divider={i < rows.length - 1}
            onPress={start}
          />
        ))}
      </Card>
      <Card style={styles.note}>
        <Icon name="repeat" size={14} color="textMuted" />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {r.spaced}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xs, paddingVertical: space.xl },
  big: { fontSize: 48, lineHeight: 54 },
  list: { padding: 0, gap: 0 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
