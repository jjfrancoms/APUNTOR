import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, IconButton, ProgressBar, Screen, Text, TopBar } from '@/components/ui';
import { useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { space, useTheme } from '@/theme';

/** Pantalla 20 · Detalle de curso */
export default function CourseDetail() {
  const s = useStrings();
  const { c } = useTheme();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const course = useStore((st) => st.courses.find((k) => k.id === courseId));
  const documentCount = useStore(
    (st) => st.documents.filter((d) => d.courseId === courseId).length,
  );
  if (!course) return <Screen header={<TopBar />}>{null}</Screen>;
  const stats = [
    [course.classes.length, s.course.classes],
    [course.topicCount, s.course.topics],
    [documentCount, s.course.documents],
  ] as const;
  return (
    <Screen
      header={
        <TopBar
          title={course.title}
          right={
            <IconButton
              icon="more-horizontal"
              label={s.common.more}
              onPress={() => router.push('/study/quiz-setup')}
            />
          }
        />
      }
      footer={
        <>
          <Button label={s.course.studyWithMascot} onPress={() => router.push('/conversation')} />
          <Button
            label={s.course.addDocument}
            variant="secondary"
            onPress={() => router.push('/upload')}
          />
        </>
      }
    >
      <View style={styles.stats}>
        {stats.map(([n, label]) => (
          <Card key={label} style={styles.stat}>
            <Text variant="title" color="primary" align="center">
              {String(n)}
            </Text>
            <Text variant="caption" color="textMuted" align="center">
              {label}
            </Text>
          </Card>
        ))}
      </View>
      <View style={styles.gapXs}>
        <View style={styles.row}>
          <Text variant="smallStrong" style={styles.flex}>
            {s.course.progress}
          </Text>
          <Text variant="smallStrong" color="primary">
            {formatPercent(course.progress)}
          </Text>
        </View>
        <ProgressBar value={course.progress} label={s.course.progress} />
      </View>
      <Text variant="overline" color="textMuted">
        {s.course.classesHeader}
      </Text>
      <Card style={styles.list}>
        {course.classes.map((klass, i) => {
          const status =
            klass.progress >= 1
              ? s.course.completed
              : klass.progress === 0
                ? s.course.notStarted
                : formatPercent(klass.progress);
          return (
            <Pressable
              key={klass.id}
              accessibilityRole="button"
              accessibilityLabel={`${klass.title}, ${status}`}
              style={[
                styles.klass,
                i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={[styles.flex, styles.gapXs]}>
                <Text variant="smallStrong">{klass.title}</Text>
                <ProgressBar value={klass.progress} label={klass.title} />
                <Text variant="caption" color="textMuted">
                  {s.course.classProgress(klass.topicCount, status)}
                </Text>
              </View>
              <Icon name="chevron-right" color="textMuted" />
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: 0, paddingVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gapXs: { gap: space.xs },
  list: { padding: 0, gap: 0 },
  klass: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
