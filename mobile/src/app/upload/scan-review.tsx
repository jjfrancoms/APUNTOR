import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { StyleSheet, View } from 'react-native';
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
import { enqueueUploads } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { fonts, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 29 · Lectura poco clara */
export default function ScanReview() {
  const s = useStrings();
  const { c } = useTheme();
  const r = s.scanReview;
  const [editing, setEditing] = useState(false);
  const [fixed, setFixed] = useState(scanReading.doubtful);
  const corrected = fixed !== scanReading.doubtful;
  const doubts = corrected ? scanReading.doubts - 1 : scanReading.doubts;
  const save = () => {
    enqueueUploads([{ name: 'Apunte escaneado.jpg', sizeMb: 0.9 }]);
    router.push('/upload/progress');
  };
  return (
    <Screen
      header={<TopBar title={r.header} />}
      footer={
        <>
          <Button label={r.fix} onPress={save} />
          <Button label={r.rescan} variant="secondary" onPress={() => router.back()} />
          <View style={styles.center}>
            <TextLink label={r.useAnyway} onPress={save} />
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
        {editing ? (
          <TextInput
            accessibilityLabel={r.tapHint}
            value={fixed}
            onChangeText={setFixed}
            onBlur={() => setEditing(false)}
            autoFocus
            multiline
            style={[
              styles.doubt,
              styles.input,
              { color: c.text, backgroundColor: c.surface, borderColor: c.primary },
            ]}
          />
        ) : (
          <Tap
            accessibilityRole="button"
            accessibilityHint={r.tapHint}
            onPress={() => setEditing(true)}
            style={[
              styles.doubt,
              {
                backgroundColor: corrected ? c.primarySoft : c.accentSoft,
                borderColor: corrected ? c.primary : c.accent,
              },
            ]}
          >
            <Text variant="small">{fixed}</Text>
          </Tap>
        )}
        <Text variant="caption" color="textMuted">
          {r.tapHint}
        </Text>
      </Card>
      <View style={styles.chips}>
        <Chip label={r.doubts(doubts)} tone="warning" icon="alert-triangle" />
        <Chip label={r.pageOf(scanReading.page, scanReading.pages)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  doubt: { borderWidth: 1, borderRadius: radius.sm, padding: space.sm },
  input: { fontFamily: fonts.regular, fontSize: 13, outlineWidth: 0, outlineColor: 'transparent' },
  chips: { flexDirection: 'row', gap: space.sm },
  center: { alignItems: 'center' },
});
