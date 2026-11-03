import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  ProgressBar,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { scanReading } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';

/** Pantalla 29 · Lectura poco clara */
export default function ScanReview() {
  const s = useStrings();
  const { c } = useTheme();
  const r = s.scanReview;
  return (
    <Screen
      header={<TopBar title={r.header} />}
      footer={
        <>
          <Button label={r.fix} onPress={() => router.push('/upload/progress')} />
          <Button label={r.rescan} variant="secondary" onPress={() => router.back()} />
          <View style={styles.center}>
            <TextLink label={r.useAnyway} onPress={() => router.push('/upload/progress')} />
          </View>
        </>
      }
    >
      <Banner tone="warning" title={r.warnTitle} body={r.warnBody} />
      <View style={styles.row}>
        <Text variant="smallStrong" style={styles.flex}>
          {r.quality}
        </Text>
        <Text variant="smallStrong">{formatPercent(scanReading.quality)}</Text>
      </View>
      <ProgressBar value={scanReading.quality} tone="accent" label={r.quality} />
      <Card>
        <Text variant="overline" color="textMuted">
          {r.read}
        </Text>
        <Text variant="small">{scanReading.text}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={r.tapHint}
          style={[styles.doubt, { backgroundColor: c.accentSoft, borderColor: c.accent }]}
        >
          <Text variant="small">{scanReading.doubtful}</Text>
        </Pressable>
        <Text variant="caption" color="textMuted">
          {r.tapHint}
        </Text>
      </Card>
      <View style={styles.chips}>
        <Chip label={r.doubts(scanReading.doubts)} tone="warning" icon="alert-triangle" />
        <Chip label={r.pageOf(scanReading.page, scanReading.pages)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  doubt: { borderWidth: 1, borderRadius: radius.sm, padding: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
  center: { alignItems: 'center' },
});
