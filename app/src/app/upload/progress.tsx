import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Chip,
  FileRow,
  IconButton,
  ProgressBar,
  Screen,
  Text,
  TopBar,
} from '@/components/ui';
import { OfflineBanner } from '@/components/domain/OfflineBanner';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { pickFiles } from '@/lib/pick-files';
import { extLabel } from '@/lib/upload-rules';
import { enqueueUploads, removeUpload, useStore } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 17 · Subiendo documentos (avance de cada archivo: subida a R2 y procesamiento en el servidor). */
export default function Uploading() {
  const s = useStrings();
  const uploads = useStore((st) => st.uploads);
  const jobs = uploads.filter((u) => u.status !== 'done');
  const active = jobs.filter((u) => u.status === 'uploading' || u.status === 'processing');
  const failed = jobs.filter((u) => u.status === 'failed');
  const ready = jobs.filter((u) => u.status === 'review');
  const ratio =
    jobs.length === 0
      ? 0
      : (ready.length +
          active.reduce(
            (a, u) => a + (u.status === 'processing' ? 0.5 + u.progress / 2 : u.progress / 2),
            0,
          )) /
        (jobs.length - failed.length || 1);
  const finished = active.length === 0;
  return (
    <Screen
      header={<TopBar title={s.uploading.header} />}
      footer={
        <>
          {finished && failed.length > 0 ? (
            <Button
              label={s.demo.seeProblems}
              variant="secondary"
              onPress={() => router.push('/upload/problems')}
            />
          ) : null}
          {finished && ready.length > 0 ? (
            <Button label={s.demo.reviewNow} onPress={() => router.push('/upload/review')} />
          ) : null}
          <Button
            label={s.uploading.addMore}
            variant="secondary"
            onPress={() => void pickFiles().then((f) => f.length > 0 && enqueueUploads(f))}
          />
        </>
      }
    >
      <OfflineBanner title={s.connection.uploads} />
      <View style={styles.head}>
        <Text variant="heading" style={styles.flex}>
          {s.uploading.count(ready.length, jobs.length - failed.length)}
        </Text>
        <Text variant="smallStrong" color="primary">
          {formatPercent(ratio)}
        </Text>
      </View>
      <ProgressBar value={ratio} label={s.uploading.count(ready.length, jobs.length)} />
      {jobs
        .filter((j) => j.status !== 'failed')
        .map((j) => {
          if (j.status === 'review') {
            return (
              <FileRow
                key={j.id}
                ext={extLabel(j.name)}
                name={j.name}
                detail={`${j.sizeMb} MB · ${s.upload.classified}`}
                trailing={<Chip label={s.upload.status.ready} tone="primary" icon="check" />}
              />
            );
          }
          if (j.status === 'processing') {
            return (
              <FileRow
                key={j.id}
                ext={extLabel(j.name)}
                name={j.name}
                detail={s.upload.classifying}
                trailing={
                  <Chip label={s.upload.status.processing} tone="warning" icon="refresh-cw" />
                }
              >
                <ProgressBar value={j.progress} tone="accent" label={j.name} />
              </FileRow>
            );
          }
          return (
            <FileRow
              key={j.id}
              ext={extLabel(j.name)}
              name={j.name}
              detail={s.upload.uploading(Math.round(j.progress * 100), `${j.sizeMb} MB`)}
              trailing={
                <IconButton
                  icon="x"
                  label={s.upload.cancelFile}
                  onPress={() => removeUpload(j.id)}
                />
              }
            >
              <ProgressBar value={j.progress} tone="accent" label={j.name} />
            </FileRow>
          );
        })}
      {failed.length > 0 ? (
        <Banner
          tone="danger"
          title={s.uploadProblems.title(failed.length)}
          body={s.uploadProblems.saved(jobs.length - failed.length)}
        />
      ) : null}
      <Banner
        tone="info"
        icon="clock"
        title={finished ? s.demo.uploadsDone : s.uploading.leaveNote}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
