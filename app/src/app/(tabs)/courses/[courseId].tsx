import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Icon,
  IconButton,
  ListRow,
  ProgressBar,
  Screen,
  Sheet,
  Text,
  TopBar,
} from '@/components/ui';
import { useState } from 'react';
import { PREVIEW } from '@/lib/config';
import { useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { layout, space, useTheme, useWide } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 20 · Detalle de curso */
export default function CourseDetail() {
  const s = useStrings();
  const { c } = useTheme();
  const wide = useWide();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [menu, setMenu] = useState(false);
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
      wide
      header={
        <TopBar
          title={course.title}
          right={
            <IconButton
              icon="more-horizontal"
              label={s.common.more}
              onPress={() => setMenu(true)}
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
      <View style={[styles.layout, wide && styles.layoutWide]}>
        <View style={[styles.summary, wide && styles.summaryWide]}>
          <View style={styles.stats}>
            {stats.map(([n, label]) => (
              <View key={label} style={styles.stat}>
                <Text variant="title" color="primary">
                  {String(n)}
                </Text>
                <Text variant="caption" color="textMuted">
                  {label}
                </Text>
              </View>
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
        </View>
        <View style={styles.classes}>
          <Text variant="heading" accessibilityRole="header">
            {s.course.classesHeader}
          </Text>
          <View>
            {course.classes.map((klass) => {
              const status =
                klass.progress >= 1
                  ? s.course.completed
                  : klass.progress === 0
                    ? s.course.notStarted
                    : formatPercent(klass.progress);
              return (
                <Tap
                  key={klass.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${klass.title}, ${status}`}
                  // Hasta la fase 2, cada clase es un documento.
                  onPress={() => router.push(`/documents/${klass.id}`)}
                  style={[
                    styles.klass,
                    { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
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
                </Tap>
              );
            })}
          </View>
        </View>
      </View>
      <Sheet visible={menu} onClose={() => setMenu(false)} title={s.courseMenu.title}>
        {PREVIEW ? (
          <ListRow
            icon="layers"
            title={s.courseMenu.quiz}
            onPress={() => {
              setMenu(false);
              router.push('/study/quiz-setup');
            }}
          />
        ) : null}
        <ListRow
          icon="upload"
          title={s.courseMenu.add}
          onPress={() => {
            setMenu(false);
            router.push('/upload');
          }}
        />
        <ListRow
          icon="file-text"
          title={s.courseMenu.documents}
          divider={false}
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/courses/search', params: { q: course.title } });
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { gap: space.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  summary: { gap: space.lg },
  summaryWide: { width: 300 },
  stats: { flexDirection: 'row', gap: space.xl },
  stat: { gap: 0 },
  classes: { flex: 1, minWidth: 0, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gapXs: { gap: space.xs },
  klass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    minHeight: layout.minTouchTarget,
  },
});
