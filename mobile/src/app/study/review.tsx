import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Button, Card, EmptyState, Icon, ListRow, Screen, Text, TopBar } from '@/components/ui';
import { reviewToday } from '@/data/mock';
import { useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 32 · Repaso del día; `?demo=empty` muestra el estado sin tarjetas (46). */
export default function DailyReview() {
  const s = useStrings();
  const r = s.dailyReview;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  // Las tarjetas que ya marcaste como sabidas salen del repaso de hoy (repetición espaciada).
  const knownCount = useStore((st) => st.study.known.length);
  const cards = Math.max(0, reviewToday.cards - knownCount);
  if (demo === 'empty' || cards === 0) {
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
  return (
    <Screen
      header={<TopBar title={r.header} />}
      footer={
        <>
          <Button label={r.start} onPress={() => router.push('/study/flashcards')} />
          <Button label={r.later} variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      <Card tone="primary" style={styles.hero}>
        <Text variant="display" color="primary" style={styles.big}>
          {String(cards)}
        </Text>
        <Text variant="bodyStrong">{r.cardsToday}</Text>
        <Text variant="caption" color="textMuted">
          {r.minutes(reviewToday.minutes)}
        </Text>
      </Card>
      <Text variant="overline" color="textMuted">
        {r.byCourse}
      </Text>
      <Card style={styles.list}>
        {reviewToday.byCourse.map((row, i) => (
          <ListRow
            key={row.course}
            title={row.course}
            detail={r.cards(row.cards)}
            divider={i < reviewToday.byCourse.length - 1}
            onPress={() => router.push('/study/flashcards')}
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
