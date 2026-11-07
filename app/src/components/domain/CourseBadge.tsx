import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui';
import type { Course } from '@/data/mock';
import { radius, useTheme } from '@/theme';

export function CourseBadge({
  course,
  size = 36,
}: {
  course: Pick<Course, 'icon' | 'tone'>;
  size?: number;
}) {
  const { c } = useTheme();
  const bg =
    course.tone === 'primary'
      ? c.primarySoft
      : course.tone === 'accent'
        ? c.accentSoft
        : c.surfaceAlt;
  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: bg }]}>
      <Icon
        name={course.icon}
        size={size * 0.5}
        color={course.tone === 'primary' ? 'primary' : 'text'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
