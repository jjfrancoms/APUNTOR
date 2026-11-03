import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CourseBadge } from '@/components/domain/CourseBadge';
import {
  Button,
  Card,
  Icon,
  ListRow,
  Mascot,
  ProgressBar,
  Screen,
  Text,
  TextLink,
} from '@/components/ui';
import { continueLearning, todayReview } from '@/data/mock';
import { FREE_DAILY_QUESTIONS, questionsToday, quotaMb, usedMb, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { layout, space, useTheme } from '@/theme';

/** Pantalla 6 · Inicio */
export default function Home() {
  const s = useStrings();
  const { c } = useTheme();
  const name = useStore((st) => st.session?.name ?? 'Ana');
  const courses = useStore((st) => st.courses);
  const docCount = useStore((st) => st.documents.length);
  const asked = useStore(questionsToday);
  const plan = useStore((st) => st.plan);
  const used = useStore(usedMb);
  const quota = useStore(quotaMb);
  const desktop = useWindowDimensions().width >= layout.breakpoints.desktop;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  // Pantalla 51 · Inicio cargando: esqueleto con la forma de la pantalla.
  if (demo === 'loading') {
    return (
      <Screen>
        <View
          accessibilityLabel={s.empty.loading}
          accessibilityRole="progressbar"
          style={styles.skeleton}
        >
          {[
            { w: '45%', h: 28 },
            { w: '65%', h: 14 },
            { w: '100%', h: 120 },
            { w: '100%', h: 96 },
            { w: '35%', h: 18 },
            { w: '100%', h: 64 },
            { w: '100%', h: 64 },
            { w: '100%', h: 64 },
          ].map((b, i) => (
            <View
              key={i}
              style={{
                width: b.w as `${number}%`,
                height: b.h,
                borderRadius: 12,
                backgroundColor: c.surfaceAlt,
              }}
            />
          ))}
        </View>
      </Screen>
    );
  }
  const greetingBlock = (
    <>
      <View>
        <Text variant="display" accessibilityRole="header">
          {s.home.hello(name)}
        </Text>
        <Text variant="small" color="textMuted">
          {s.home.subtitle}
        </Text>
      </View>
    </>
  );
  const main = (
    <>
      <Card tone="primary" style={styles.review}>
        <Mascot size={desktop ? 112 : 80} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{s.home.review(todayReview.topic)}</Text>
          <View style={styles.start}>
            <Button label={s.home.reviewNow} compact onPress={() => router.push('/study/review')} />
          </View>
        </View>
      </Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${s.home.continue}: ${continueLearning.title}`}
        onPress={() => router.push(`/courses/topics/${continueLearning.topicId}`)}
      >
        <Card>
          <Text variant="overline" color="textMuted">
            {s.home.continue.toUpperCase()}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{continueLearning.title}</Text>
              <Text variant="caption" color="textMuted">
                {continueLearning.location}
              </Text>
            </View>
            <Icon name="chevron-right" color="textMuted" />
          </View>
          <ProgressBar value={continueLearning.progress} label={continueLearning.title} />
        </Card>
      </Pressable>
      <View style={styles.row}>
        <Text variant="heading" style={styles.flex}>
          {s.home.myCourses}
        </Text>
        <TextLink label={s.common.seeAll} onPress={() => router.navigate('/courses')} />
      </View>
      <Card style={styles.list}>
        {courses.map((course, i) => (
          <Pressable
            key={course.id}
            accessibilityRole="button"
            accessibilityLabel={`${course.title}, ${formatPercent(course.progress)}`}
            onPress={() => router.push(`/courses/${course.id}`)}
            style={[
              styles.courseRow,
              i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <CourseBadge course={course} size={32} />
            <View style={styles.flex}>
              <View style={styles.row}>
                <Text variant="smallStrong" style={styles.flex}>
                  {course.title}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatPercent(course.progress)}
                </Text>
              </View>
              <ProgressBar value={course.progress} label={course.title} />
            </View>
          </Pressable>
        ))}
      </Card>
    </>
  );
  // Columna lateral (solo escritorio): resumen de uso y accesos rápidos.
  const side = (
    <>
      <Text variant="heading">{s.home.summary}</Text>
      <Card style={styles.summary}>
        <View style={styles.stat}>
          <Text variant="small" color="textMuted" style={styles.flex}>
            {s.home.documents}
          </Text>
          <Text variant="bodyStrong">{docCount}</Text>
        </View>
        {plan === 'free' ? (
          <View style={styles.flex}>
            <View style={styles.stat}>
              <Text variant="small" color="textMuted" style={styles.flex}>
                {s.home.questions}
              </Text>
              <Text variant="bodyStrong">{`${asked} / ${FREE_DAILY_QUESTIONS}`}</Text>
            </View>
            <ProgressBar value={asked / FREE_DAILY_QUESTIONS} label={s.home.questions} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <View style={styles.stat}>
            <Text variant="small" color="textMuted" style={styles.flex}>
              {s.home.storage}
            </Text>
            <Text variant="bodyStrong">{s.home.of(`${used} MB`, `${quota} MB`)}</Text>
          </View>
          <ProgressBar value={used / quota} label={s.home.storage} />
        </View>
      </Card>
      <Text variant="heading">{s.home.quickActions}</Text>
      <Card style={styles.list}>
        <ListRow
          icon="check-square"
          title={s.home.quiz}
          onPress={() => router.push('/study/quiz-setup')}
        />
        <ListRow
          icon="layers"
          title={s.home.flashcards}
          onPress={() => router.push('/study/flashcards')}
        />
        <ListRow
          icon="message-circle"
          title={s.home.ask}
          divider={false}
          onPress={() => router.push('/conversation')}
        />
      </Card>
    </>
  );
  if (desktop) {
    return (
      <Screen wide>
        {greetingBlock}
        <View style={styles.columns}>
          <View style={styles.mainCol}>{main}</View>
          <View style={styles.sideCol}>{side}</View>
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      {greetingBlock}
      {main}
    </Screen>
  );
}

const styles = StyleSheet.create({
  review: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  skeleton: { gap: space.md },
  start: { alignItems: 'flex-start', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, gap: space.xs },
  list: { padding: 0, gap: 0 },
  summary: { gap: space.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  mainCol: { flex: 2, gap: space.lg, minWidth: 0 },
  sideCol: { flex: 1, gap: space.lg, minWidth: 0 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
