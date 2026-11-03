import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  FileRow,
  IconButton,
  ProgressBar,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { storage } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 18 · Subida con problemas (códigos UP_FORMAT, UP_SIZE, UP_NETWORK, UP_QUOTA). */
export default function UploadProblems() {
  const s = useStrings();
  const p = s.uploadProblems;
  const remove = <IconButton icon="x" label={p.dismiss} />;
  return (
    <Screen
      header={<TopBar title={p.header} />}
      footer={<Button label={p.retryFailed} onPress={() => router.replace('/upload/progress')} />}
    >
      <Banner tone="danger" title={p.title(3)} body={p.saved(2)} />
      <FileRow
        tone="danger"
        ext="RAR"
        name="Examen final.rar"
        detail={p.formatTitle}
        detailTone="danger"
        trailing={remove}
      >
        <Text variant="caption" color="textMuted">
          {p.formatBody}
        </Text>
        <TextLink label={p.chooseOther} onPress={() => router.push('/upload')} />
      </FileRow>
      <FileRow
        tone="danger"
        ext="MP4"
        name="Clase grabada.mp4"
        detail={p.sizeTitle}
        detailTone="danger"
        trailing={remove}
      >
        <Text variant="caption" color="textMuted">
          {p.sizeBody(212)}
        </Text>
        <TextLink label={p.remove} />
      </FileRow>
      <FileRow
        tone="danger"
        ext="PDF"
        name="Resumen cap. 4.pdf"
        detail={p.networkTitle}
        detailTone="danger"
        trailing={remove}
      >
        <Text variant="caption" color="textMuted">
          {p.networkBody}
        </Text>
        <TextLink label={p.retry} />
      </FileRow>
      <Card tone="accent">
        <View style={styles.row}>
          <Text variant="smallStrong" style={styles.flex}>
            {p.space}
          </Text>
          <Text variant="smallStrong">{p.spaceValue(storage.usedMb, storage.totalMb)}</Text>
        </View>
        <ProgressBar value={storage.usedMb / storage.totalMb} tone="accent" label={p.space} />
        <TextLink label={p.seePlans} onPress={() => router.push('/plans')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
