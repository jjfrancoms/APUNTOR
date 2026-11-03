import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  FileRow,
  IconButton,
  ProgressBar,
  Screen,
  Text,
  TopBar,
  Banner,
} from '@/components/ui';
import { uploadProgress } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { readyRatio } from '@/lib/upload';
import { space } from '@/theme';

/** Pantalla 17 · Subiendo documentos */
export default function Uploading() {
  const s = useStrings();
  const ratio = readyRatio(uploadProgress);
  const done = uploadProgress.filter((f) => f.status === 'ready').length;
  return (
    <Screen
      header={<TopBar title={s.uploading.header} />}
      footer={
        <Button
          label={s.uploading.addMore}
          variant="secondary"
          onPress={() => router.push('/upload')}
        />
      }
    >
      <View style={styles.head}>
        <Text variant="heading" style={styles.flex}>
          {s.uploading.count(done, uploadProgress.length)}
        </Text>
        <Text variant="smallStrong" color="primary">
          {formatPercent(ratio)}
        </Text>
      </View>
      <ProgressBar value={ratio} label={s.uploading.count(done, uploadProgress.length)} />
      {uploadProgress.map((f) => {
        if (f.status === 'ready') {
          return (
            <FileRow
              key={f.id}
              ext={f.ext}
              name={f.name}
              detail={`${f.size} · ${s.upload.classified}`}
              trailing={<Chip label={s.upload.status.ready} tone="primary" icon="check" />}
            />
          );
        }
        if (f.status === 'processing') {
          return (
            <FileRow
              key={f.id}
              ext={f.ext}
              name={f.name}
              detail={s.upload.classifying}
              trailing={
                <Chip label={s.upload.status.processing} tone="warning" icon="refresh-cw" />
              }
            >
              <ProgressBar value={f.progress ?? 0} tone="accent" label={f.name} />
            </FileRow>
          );
        }
        return (
          <FileRow
            key={f.id}
            ext={f.ext}
            name={f.name}
            detail={s.upload.uploading(Math.round((f.progress ?? 0) * 100), f.total ?? f.size)}
            trailing={<IconButton icon="x" label={s.upload.cancelFile} />}
          >
            <ProgressBar value={f.progress ?? 0} tone="accent" label={f.name} />
          </FileRow>
        );
      })}
      <Banner tone="info" icon="clock" title={s.uploading.leaveNote} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
