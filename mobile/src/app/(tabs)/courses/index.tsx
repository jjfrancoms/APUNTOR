import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CourseBadge } from '@/components/domain/CourseBadge';
import { Button, Card, Icon, Mascot, Screen, Text } from '@/components/ui';
import { courses as allCourses, pendingReviewCount, type Course } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

/** Pantalla 3 · Cursos y temas, con su estado vacío (pantalla 8). `?demo=empty` muestra el vacío. */
export default function Courses() {
  const s = useStrings();
  const { c } = useTheme();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const courses = demo === 'empty' ? [] : allCourses;
  const [expanded, setExpanded] = useState<string | null>(allCourses[0]?.id ?? null);

  if (courses.length === 0) {
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
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={s.courses.search}
        onPress={() => router.push('/courses/search')}
        style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Icon name="search" size={18} color="textMuted" />
        <Text variant="body" color="textMuted">
          {s.courses.search}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        style={[styles.banner, { backgroundColor: c.accentSoft }]}
      >
        <Icon name="star" size={16} />
        <Text variant="smallStrong" style={styles.flex}>
          {s.courses.pendingReview(pendingReviewCount)}
        </Text>
        <Icon name="chevron-right" size={16} />
      </Pressable>
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          open={expanded === course.id}
          onToggle={() => setExpanded(expanded === course.id ? null : course.id)}
        />
      ))}
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
  return (
    <Card style={styles.course}>
      <Pressable
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
      </Pressable>
      {open
        ? course.classes
            .filter((k) => k.sections.length > 0 || k.progress < 1)
            .slice(0, 2)
            .map((klass, idx) => (
              <View key={klass.id} style={styles.klass}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/courses/${course.id}`)}
                  style={styles.klassHead}
                >
                  <Icon
                    name={idx === 0 ? 'chevron-down' : 'chevron-right'}
                    size={16}
                    color="textMuted"
                  />
                  <Text variant="smallStrong" style={styles.flex}>
                    {klass.title}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {s.courses.sections(Math.max(klass.sections.length, 2))}
                  </Text>
                </Pressable>
                {idx === 0
                  ? klass.sections.map((section) => (
                      <View key={section.title} style={styles.section}>
                        <Text variant="overline" color="textMuted">
                          {section.title}
                        </Text>
                        {section.topics.map((topic, t) => {
                          const active = t === 0 && section === klass.sections[0];
                          return (
                            <Pressable
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
                            </Pressable>
                          );
                        })}
                      </View>
                    ))
                  : null}
              </View>
            ))
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
    minHeight: 40,
    borderRadius: radius.sm,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  flex: { flex: 1 },
});
