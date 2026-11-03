import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  Mascot,
  Screen,
  Segmented,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { quizSetupData } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';

type Amount = (typeof quizSetupData.amounts)[number];

/** Pantalla 31 · Quiz: configuración. Cantidad 5, 10 o 20 con dificultad adaptativa. */
export default function QuizSetup() {
  const s = useStrings();
  const { c } = useTheme();
  const q = s.quizSetup;
  const [amount, setAmount] = useState<Amount>('10');
  return (
    <Screen
      header={<TopBar icon="x" title={q.header} />}
      footer={
        <Button
          label={q.start}
          onPress={() => router.push({ pathname: '/study/quiz', params: { n: amount } })}
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
          <Text variant="bodyStrong">{quizSetupData.topic}</Text>
          <Text variant="caption" color="textMuted">
            {quizSetupData.location}
          </Text>
        </View>
        <TextLink label={s.common.change} />
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
        <Chip label={q.documents(quizSetupData.documents)} tone="primary" icon="file-text" />
        <Chip label={q.minutes(quizSetupData.minutes)} icon="clock" />
      </View>
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
