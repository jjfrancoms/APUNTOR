import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Chip,
  EmptyState,
  FileRow,
  Screen,
  SelectField,
  Text,
  TextField,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { confidenceLevel } from '@/lib/classification';
import { extLabel } from '@/lib/upload-rules';
import type { ClassificationAction } from '@/lib/api';
import type { DocRecord } from '@/store/seed';
import { decideClassification, pendingReview, refreshAll, useStore } from '@/store/store';
import { space, useTheme } from '@/theme';

type Mode = 'idle' | 'choose' | 'create';

/**
 * Pantalla 16 · Revisar clasificación: la IA sugiere un curso por documento y la persona decide
 * (aceptar, elegir otro, crear uno o dejarlo para después). Nada se mueve sin confirmar.
 */
export default function ReviewClassification() {
  const s = useStrings();
  const { c } = useTheme();
  const items = useStore(pendingReview);
  const courses = useStore((st) => st.courses);
  const sync = useStore((st) => st.sync);

  if (sync.loading && items.length === 0) {
    return (
      <Screen header={<TopBar title={s.review.header} />}>
        <View
          accessibilityLabel={s.review.loading}
          accessibilityRole="progressbar"
          style={styles.center}
        >
          <ActivityIndicator color={c.primary} />
          <Text variant="small" color="textMuted">
            {s.review.loading}
          </Text>
        </View>
      </Screen>
    );
  }
  if (sync.error && items.length === 0) {
    return (
      <Screen header={<TopBar title={s.review.header} />}>
        <Banner tone="danger" title={s.review.error}>
          <TextLink label={s.live.retry} color="danger" onPress={() => void refreshAll()} />
        </Banner>
      </Screen>
    );
  }
  if (items.length === 0) {
    return (
      <Screen header={<TopBar title={s.review.header} />}>
        <EmptyState
          title={s.review.emptyTitle}
          body={s.review.emptyBody}
          primary={{ label: s.review.emptyAction, onPress: () => router.replace('/courses') }}
        />
      </Screen>
    );
  }
  const options = courses.map((course) => ({
    value: course.id,
    label: course.title,
    detail: s.courses.classesTopics(course.classes.length, course.topicCount),
  }));
  return (
    <Screen header={<TopBar title={s.review.header} />}>
      <Text variant="small" color="textMuted">
        {s.review.intro(items.length)}
      </Text>
      {items.map((doc) => (
        <ReviewRow key={doc.id} doc={doc} options={options} />
      ))}
    </Screen>
  );
}

function ReviewRow({
  doc,
  options,
}: {
  doc: DocRecord;
  options: { value: string; label: string; detail: string }[];
}) {
  const s = useStrings();
  const [mode, setMode] = useState<Mode>('idle');
  const [courseName, setCourseName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { courseId, courseTitle, confidence, reason } = doc.classification;
  const level = confidenceLevel(confidence);

  const decide = async (decision: ClassificationAction) => {
    setBusy(true);
    setFailed(false);
    const saved = await decideClassification(doc.id, decision);
    // Si se guardó, el documento sale de la lista y esta fila desaparece.
    if (!saved) {
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <FileRow
      tone={level === 'low' ? 'warning' : 'default'}
      ext={extLabel(doc.name)}
      name={doc.name}
      detail=""
    >
      <Chip
        label={s.review.confidence[level]}
        tone={level === 'high' ? 'primary' : level === 'medium' ? 'neutral' : 'warning'}
        icon={level === 'low' ? 'alert-triangle' : 'check'}
      />
      {courseTitle ? (
        <Text variant="smallStrong">
          {courseId ? s.review.suggested(courseTitle) : s.review.suggestedNew(courseTitle)}
        </Text>
      ) : null}
      {reason ? (
        <Text variant="caption" color="textMuted">
          {s.review.reason(reason)}
        </Text>
      ) : null}
      {failed ? (
        <Text variant="small" color="danger">
          {s.live.actionFailed}
        </Text>
      ) : null}
      {mode === 'choose' ? (
        <SelectField
          label={s.review.question}
          placeholder={s.review.choose}
          options={options}
          defaultOpen
          onSelect={(chosen) => void decide({ action: 'choose', courseId: chosen })}
        />
      ) : null}
      {mode === 'create' ? (
        <>
          <TextField
            label={s.live.newCourseLabel}
            placeholder={s.live.newCoursePlaceholder}
            value={courseName}
            onChangeText={setCourseName}
            autoFocus
          />
          <Button
            label={s.review.newCourse}
            compact
            loading={busy}
            disabled={courseName.trim().length === 0}
            onPress={() => void decide({ action: 'create', title: courseName.trim() })}
          />
        </>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={s.review.accept}
          compact
          loading={busy && mode === 'idle'}
          disabled={busy}
          onPress={() => void decide({ action: 'accept' })}
        />
        <Button
          label={s.review.chooseOther}
          compact
          variant="secondary"
          disabled={busy}
          onPress={() => setMode(mode === 'choose' ? 'idle' : 'choose')}
        />
        <Button
          label={s.review.newCourse}
          compact
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setMode(mode === 'create' ? 'idle' : 'create');
            setCourseName('');
          }}
        />
        <Button
          label={s.review.notNow}
          compact
          variant="secondary"
          disabled={busy}
          onPress={() => void decide({ action: 'dismiss' })}
        />
      </View>
    </FileRow>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
