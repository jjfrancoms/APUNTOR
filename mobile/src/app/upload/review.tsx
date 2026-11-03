import { router } from 'expo-router';
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
import { reviewItems } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 16 · Revisar clasificación: propone y, si duda, pregunta. */
export default function ReviewClassification() {
  const s = useStrings();
  const confirmed = reviewItems.filter((r) => r.confident).length;
  return (
    <Screen
      header={<TopBar title={s.review.header} />}
      footer={
        <>
          <Button label={s.review.save(confirmed)} onPress={() => router.replace('/courses')} />
          <Button
            label={s.review.later}
            variant="secondary"
            onPress={() => router.replace('/home')}
          />
        </>
      }
    >
      <Text variant="small" color="textMuted">
        {s.review.intro(reviewItems.length)}
      </Text>
      {reviewItems.map((r) =>
        r.confident ? (
          <FileRow key={r.id} ext={r.ext} name={r.name} detail="" trailing={null}>
            <Chip label={s.review.high} tone="primary" icon="check" />
            <View style={styles.row}>
              <Text variant="caption" color="textMuted" style={styles.flex}>
                {r.path.slice(0, -1).join(' › ')} ›{' '}
                <Text variant="caption" color="primary">
                  {r.path.at(-1) ?? ''}
                </Text>
              </Text>
              <TextLink label={s.common.change} />
            </View>
          </FileRow>
        ) : (
          <FileRow key={r.id} tone="warning" ext={r.ext} name={r.name} detail="">
            <Chip label={s.review.needs} tone="warning" icon="alert-triangle" />
            <SelectField label={s.review.question} placeholder={s.review.choose} />
            <View style={styles.row}>
              <Icon name="plus" size={14} color="primary" />
              <TextLink label={s.review.newCourse} />
            </View>
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
