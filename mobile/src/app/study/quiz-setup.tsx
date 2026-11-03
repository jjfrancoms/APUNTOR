import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  Icon,
  ListRow,
  Mascot,
  Sheet,
  Screen,
  Segmented,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { quizSetupData } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { useStore } from '@/store/store';
import { radius, space, useTheme } from '@/theme';

type Amount = (typeof quizSetupData.amounts)[number];

/** Pantalla 31 · Quiz: configuración. Cantidad 5, 10 o 20 con dificultad adaptativa. */
export default function QuizSetup() {
  const s = useStrings();
  const { c } = useTheme();
  const q = s.quizSetup;
  const [amount, setAmount] = useState<Amount>('10');
  const params = useLocalSearchParams<{ classId?: string }>();
  const [classId, setClassId] = useState(params.classId ?? 'c3');
  const [choosing, setChoosing] = useState(false);
  const courses = useStore((st) => st.courses);
  const items = useStore((st) => st.items);
  const course = courses.find((co) => co.classes.some((k) => k.id === classId));
  const klass = course?.classes.find((k) => k.id === classId);
  const classItems = items.filter((i) => i.classId === classId);
  const documents = new Set(classItems.map((i) => i.documentId)).size;
  return (
    <Screen
      header={<TopBar icon="x" title={q.header} />}
      footer={
        <Button
          label={q.start}
          disabled={classItems.length === 0}
          onPress={() => router.push({ pathname: '/study/quiz', params: { n: amount, classId } })}
        />
      }
    >
      <View style={styles.bubbleRow}>
        <Mascot size={64} />
        <View style={[styles.bubble, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text variant="smallStrong">{q.mascot}</Text>
        </View>
      </View>
      <Text variant="overline" color="textMuted">
        {q.topic}
      </Text>
      <Card style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {klass?.title.split(' · ')[1] ?? klass?.title ?? quizSetupData.topic}
          </Text>
          <Text variant="caption" color="textMuted">
            {course
              ? `${course.title} · ${klass?.title.split(' · ')[0] ?? ''}`
              : quizSetupData.location}
          </Text>
        </View>
        <TextLink label={s.common.change} onPress={() => setChoosing(true)} />
      </Card>
      <Text variant="overline" color="textMuted">
        {q.amount}
      </Text>
      <Segmented
        options={quizSetupData.amounts.map((a) => ({ value: a, label: a }))}
        value={amount}
        onChange={setAmount}
      />
      <Banner tone="info" icon="layers" title={q.adaptive} />
      <View style={styles.chips}>
        <Chip label={q.documents(documents)} tone="primary" icon="file-text" />
        <Chip label={q.minutes(Math.max(2, Math.round(Number(amount) * 0.8)))} icon="clock" />
      </View>
      <Sheet visible={choosing} onClose={() => setChoosing(false)} title={q.topic}>
        {courses.flatMap((co) =>
          co.classes.map((k) => (
            <ListRow
              key={k.id}
              title={k.title}
              detail={co.title}
              trailing={k.id === classId ? <Icon name="check" color="primary" /> : undefined}
              onPress={() => {
                setClassId(k.id);
                setChoosing(false);
              }}
            />
          )),
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bubble: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: space.sm },
});
