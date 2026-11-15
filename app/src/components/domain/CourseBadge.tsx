import { View } from 'react-native';
import { Icon } from '@/components/ui';
import type { Course } from '@/data/mock';

/**
 * Ícono del curso: plano, sin recuadro de color (el ícono funcional va solo). El tono del curso
 * solo cambia el color del trazo.
 */
export function CourseBadge({
  course,
  size = 36,
}: {
  course: Pick<Course, 'icon' | 'tone'>;
  size?: number;
}) {
  return (
    <View style={{ width: size * 0.67, alignItems: 'flex-start' }}>
      <Icon
        name={course.icon}
        size={size * 0.6}
        color={course.tone === 'primary' ? 'primary' : 'textMuted'}
      />
    </View>
  );
}
