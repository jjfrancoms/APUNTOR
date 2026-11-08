import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CourseBadge } from '@/components/domain/CourseBadge';
import { OfflineBanner } from '@/components/domain/OfflineBanner';
import { checkConnection, useOnline } from '@/lib/online';
import { Button, Card, Chip, EmptyState, Icon, Mascot, Screen, Text } from '@/components/ui';
import type { Course } from '@/data/mock';
import { TopicOutline } from '@/components/domain/TopicOutline';
import { loadDocumentTopics, pendingReview, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 3 · Cursos y temas, con su estado vacío (pantalla 8). `?demo=empty` muestra el vacío. */
export default function Courses() {
  const s = useStrings();
  const { c } = useTheme();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const allCourses = useStore((st) => st.courses);
  const pendingReviewCount = useStore((st) => pendingReview(st).length);
  const documents = useStore((st) => st.documents);
  const unassigned = useMemo(() => documents.filter((d) => d.courseId === ''), [documents]);
  const courses = demo === 'empty' ? [] : allCourses;
  const [expanded, setExpanded] = useState<string | null>(allCourses[0]?.id ?? null);
  const online = useOnline();

  if (demo === 'offline') {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {s.courses.title}
        </Text>
        <EmptyState
          mood="sleepy"
          title={s.empty.offlineTitle}
          body={s.empty.offlineBody}
          primary={{ label: s.empty.downloaded, onPress: () => router.replace('/courses') }}
          secondary={{ label: s.empty.retry, onPress: () => router.replace('/courses') }}
        />
      </Screen>
    );
  }

  // Los cursos no se guardan en el dispositivo: sin red y sin datos no hay nada que mostrar.
  if (!online && courses.length === 0 && unassigned.length === 0) {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {s.courses.title}
        </Text>
        <EmptyState
          mood="sleepy"
          title={s.empty.offlineTitle}
          body={s.connection.coursesBody}
          primary={{ label: s.empty.retry, onPress: checkConnection }}
        />
      </Screen>
    );
  }

  if (courses.length === 0 && unassigned.length === 0) {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {s.courses.title}
        </Text>
        <View style={styles.empty}>
          <Mascot size={110} halo />
          <Text variant="heading" align="center">
            {s.courses.emptyTitle}
          </Text>
          <Text variant="small" color="textMuted" align="center">
            {s.courses.emptyBody}
          </Text>
          <View style={styles.emptyActions}>
            <Button label={s.courses.emptyUpload} onPress={() => router.push('/upload')} />
            <Button
              label={s.courses.howItWorks}
              variant="secondary"
              onPress={() => router.push('/profile/help')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {s.courses.title}
      </Text>
      <OfflineBanner title={s.connection.courses} />
      <Tap
        accessibilityRole="search"
        accessibilityLabel={s.courses.search}
        onPress={() => router.push('/courses/search')}
        style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Icon name="search" size={18} color="textMuted" />
        <Text variant="body" color="textMuted">
          {s.courses.search}
        </Text>
      </Tap>
      {pendingReviewCount > 0 ? (
        <Tap
          accessibilityRole="button"
          onPress={() => router.push('/upload/review')}
          style={[styles.banner, { backgroundColor: c.accentSoft }]}
        >
          <Icon name="star" size={16} />
          <Text variant="smallStrong" style={styles.flex}>
            {s.courses.pendingReview(pendingReviewCount)}
          </Text>
          <Icon name="chevron-right" size={16} />
        </Tap>
      ) : null}
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          open={expanded === course.id}
          onToggle={() => setExpanded(expanded === course.id ? null : course.id)}
        />
      ))}
      {unassigned.length > 0 ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            {s.live.unassignedTitle}
          </Text>
          <Card style={styles.course}>
            {unassigned.map((doc) => (
              <Tap
                key={doc.id}
                accessibilityRole="button"
                accessibilityLabel={`${doc.name}, ${s.live.status[doc.status]}`}
                onPress={() => router.push(`/documents/${doc.id}`)}
                style={styles.klassHead}
              >
                <Icon name="file-text" size={16} color="textMuted" />
                <Text variant="smallStrong" style={styles.flex} numberOfLines={1}>
                  {doc.name}
                </Text>
                <Chip
                  label={s.live.status[doc.status]}
                  tone={doc.status === 'failed' ? 'danger' : 'neutral'}
                />
              </Tap>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function CourseCard({
  course,
  open,
  onToggle,
}: {
  course: Course;
  open: boolean;
  onToggle: () => void;
}) {
  const s = useStrings();
  const { c } = useTheme();
  const items = useStore((st) => st.items);
  const documents = useStore((st) => st.documents);
  // Por defecto se abre la primera clase sin terminar.
  const [openClass, setOpenClass] = useState<string | null>(
    course.classes.find((k) => k.progress < 1)?.id ?? null,
  );
  // Hasta la fase 2 cada documento es una clase: sus temas se piden al abrirla.
  const openDoc = open ? documents.find((d) => d.id === openClass) : undefined;
  const needsTopics = openDoc?.status === 'completed' && openDoc.outline === undefined;
  useEffect(() => {
    if (needsTopics && openClass) void loadDocumentTopics(openClass);
  }, [needsTopics, openClass]);
  return (
    <Card style={styles.course}>
      <Tap
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={course.title}
        onPress={onToggle}
        style={styles.courseHead}
      >
        <CourseBadge course={course} />
        <View style={styles.flex}>
          <Text variant="subheading">{course.title}</Text>
          <Text variant="caption" color="textMuted">
            {s.courses.classesTopics(course.classes.length, course.topicCount)}
          </Text>
        </View>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} color="textMuted" />
      </Tap>
      {open
        ? course.classes.map((klass) => {
            const classItems = items.filter((i) => i.classId === klass.id);
            const sections = [
              { title: s.classView.theory, list: classItems.filter((i) => i.kind !== 'ejercicio') },
              {
                title: s.classView.exercises,
                list: classItems.filter((i) => i.kind === 'ejercicio'),
              },
            ].filter((sec) => sec.list.length > 0);
            const expanded = openClass === klass.id;
            const doc = documents.find((d) => d.id === klass.id);
            const roots = doc?.outline?.filter((t) => t.depth === 1).length;
            const countLabel =
              sections.length > 0
                ? s.courses.sections(sections.length)
                : roots !== undefined && roots > 0
                  ? s.courses.sections(roots)
                  : s.courses.topicsCount(klass.topicCount);
            return (
              <View key={klass.id} style={styles.klass}>
                <Tap
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={klass.title}
                  onPress={() => setOpenClass(expanded ? null : klass.id)}
                  style={styles.klassHead}
                >
                  <Icon
                    name={expanded ? 'chevron-down' : 'chevron-right'}
                    size={16}
                    color="textMuted"
                  />
                  <Text variant="smallStrong" style={styles.flex}>
                    {klass.title}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {countLabel}
                  </Text>
                </Tap>
                {expanded ? (
                  <>
                    {sections.length === 0 && doc ? (
                      <View style={styles.section}>
                        {doc.status !== 'completed' ? (
                          <Text variant="small" color="textMuted">
                            {s.live.status[doc.status]}
                          </Text>
                        ) : doc.outline === undefined ? (
                          <Text variant="small" color="textMuted">
                            {s.courses.loadingTopics}
                          </Text>
                        ) : doc.outline.length === 0 ? (
                          <Text variant="small" color="textMuted">
                            {s.courses.noTopics}
                          </Text>
                        ) : (
                          <TopicOutline documentId={doc.id} outline={doc.outline} />
                        )}
                      </View>
                    ) : null}
                    {sections.map((section) => (
                      <View key={section.title} style={styles.section}>
                        <Text variant="overline" color="textMuted">
                          {section.title}
                        </Text>
                        {section.list.map((topic, t) => {
                          const active = t === 0 && section === sections[0];
                          return (
                            <Tap
                              key={topic.id}
                              accessibilityRole="link"
                              accessibilityLabel={topic.title}
                              onPress={() => router.push(`/courses/topics/${topic.id}`)}
                              style={[styles.topic, active && { backgroundColor: c.primarySoft }]}
                            >
                              <View
                                style={[
                                  styles.dot,
                                  { backgroundColor: active ? c.primary : c.textMuted },
                                ]}
                              />
                              <Text variant="small" color={active ? 'primary' : 'text'}>
                                {topic.title}
                              </Text>
                            </Tap>
                          );
                        })}
                      </View>
                    ))}
                    <View style={styles.section}>
                      <Tap
                        accessibilityRole="link"
                        onPress={() => router.push(`/documents/${klass.id}`)}
                        style={styles.openClass}
                      >
                        <Text variant="smallStrong" color="primary">
                          {s.classView.open}
                        </Text>
                        <Icon name="arrow-right" size={14} color="primary" />
                      </Tap>
                    </View>
                  </>
                ) : null}
              </View>
            );
          })
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.xxxl,
  },
  emptyActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: layout.minTouchTarget,
  },
  course: { gap: space.md },
  courseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minTouchTarget,
  },
  klass: { gap: space.xs },
  klassHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
  section: { paddingLeft: space.xxl, gap: space.xs },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.sm,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  openClass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget,
  },
  flex: { flex: 1 },
});
