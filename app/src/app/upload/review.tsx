import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  FileRow,
  Icon,
  Screen,
  SelectField,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { extLabel } from '@/lib/upload-rules';
import { assignUploadCourse, confirmUploads, createCourse, useStore } from '@/store/store';
import { space } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 16 · Revisar clasificación: propone y, si duda, pregunta. Guarda solo lo confirmado. */
export default function ReviewClassification() {
  const s = useStrings();
  const uploads = useStore((st) => st.uploads);
  const courses = useStore((st) => st.courses);
  const items = uploads.filter((u) => u.status === 'review');
  const confirmed = items.filter((r) => r.courseId).length;
  // Fila cuyo curso se está cambiando (las de alta confianza muestran el selector al tocar "Cambiar").
  const [editing, setEditing] = useState<string | null>(null);
  const options = courses.map((c) => ({
    value: c.id,
    label: c.title,
    detail: s.courses.classesTopics(c.classes.length, c.topicCount),
  }));
  return (
    <Screen
      header={<TopBar title={s.review.header} />}
      footer={
        <>
          <Button
            label={s.review.save(confirmed)}
            disabled={confirmed === 0}
            onPress={() => {
              confirmUploads();
              router.replace('/courses');
            }}
          />
          <Button
            label={s.review.later}
            variant="secondary"
            onPress={() => router.replace('/home')}
          />
        </>
      }
    >
      <Text variant="small" color="textMuted">
        {s.review.intro(items.length)}
      </Text>
      {items.map((r) =>
        r.courseId && editing !== r.id ? (
          <FileRow key={r.id} ext={extLabel(r.name)} name={r.name} detail="">
            <Chip label={s.review.high} tone="primary" icon="check" />
            <View style={styles.row}>
              <Text variant="caption" color="textMuted" style={styles.flex}>
                {r.path.slice(0, -1).join(' › ')} ›{' '}
                <Text variant="caption" color="primary">
                  {r.path.at(-1) ?? ''}
                </Text>
              </Text>
              <TextLink label={s.common.change} onPress={() => setEditing(r.id)} />
            </View>
          </FileRow>
        ) : (
          <FileRow
            key={r.id}
            tone={r.courseId ? 'default' : 'warning'}
            ext={extLabel(r.name)}
            name={r.name}
            detail=""
          >
            {r.courseId ? null : (
              <Chip label={s.review.needs} tone="warning" icon="alert-triangle" />
            )}
            <SelectField
              label={s.review.question}
              placeholder={s.review.choose}
              options={options}
              selected={r.courseId}
              defaultOpen={editing === r.id}
              onSelect={(courseId) => {
                assignUploadCourse(r.id, courseId);
                setEditing(null);
              }}
            />
            <Tap
              accessibilityRole="button"
              hitSlop={13}
              style={styles.row}
              onPress={() => assignUploadCourse(r.id, createCourse(s.demo.newCourseName))}
            >
              <Icon name="plus" size={14} color="primary" />
              <Text variant="smallStrong" color="primary">
                {s.review.newCourse}
              </Text>
            </Tap>
          </FileRow>
        ),
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1 },
});
