import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FileRow,
  Icon,
  IconButton,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { pickFiles, SAMPLE_FILES } from '@/lib/pick-files';
import { extLabel } from '@/lib/upload-rules';
import { jobTone } from '@/lib/upload-view';
import {
  enqueueUploads,
  removeUpload,
  useStore,
  type PickedFile,
  type UploadJob,
} from '@/store/store';
import { radius, space, useTheme } from '@/theme';

/** Pantalla 2 · Subir documentos. Valida al elegir; la subida sigue en segundo plano. */
export default function Upload() {
  const s = useStrings();
  const { c } = useTheme();
  const uploads = useStore((st) => st.uploads);
  const jobs = uploads.filter(
    (u) => u.status !== 'done' && !(u.status === 'review' && u.id.startsWith('up-r')),
  );
  const plan = jobs.find((j) => j.path.length > 0)?.path ?? [];
  const add = (files: PickedFile[]) => {
    if (files.length > 0) enqueueUploads(files);
  };
  const label = (j: UploadJob) =>
    j.status === 'failed'
      ? s.errors[j.error ?? 'UP_FORMAT']
      : j.status === 'review'
        ? s.upload.status.ready
        : j.status === 'processing'
          ? s.upload.status.analyzing
          : s.upload.status.queued;
  return (
    <Screen
      header={<TopBar title={s.upload.header} />}
      footer={
        <>
          <Button
            label={s.upload.scan}
            variant="secondary"
            icon="camera"
            onPress={() => router.push('/upload/scan')}
          />
          <Button
            label={s.upload.confirm}
            disabled={jobs.length === 0}
            onPress={() => router.push('/upload/progress')}
          />
        </>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${s.upload.dropTitle}. ${s.upload.dropDetail}`}
        onPress={() => void pickFiles().then(add)}
        style={[styles.drop, { backgroundColor: c.primarySoft, borderColor: c.primary }]}
      >
        <View style={[styles.dropIcon, { backgroundColor: c.surface }]}>
          <Icon name="upload" size={20} color="primary" />
        </View>
        <Text variant="bodyStrong">{s.upload.dropTitle}</Text>
        <Text variant="caption" color="textMuted" align="center">
          {s.upload.dropDetail}
        </Text>
      </Pressable>
      <View style={styles.center}>
        <TextLink label={s.demo.sampleFiles} onPress={() => add(SAMPLE_FILES)} />
      </View>
      {jobs.length === 0 ? (
        <Text variant="small" color="textMuted" align="center">
          {s.demo.noUploads}
        </Text>
      ) : (
        <>
          <Text variant="smallStrong">{s.upload.processing(jobs.length)}</Text>
          {jobs.map((j) => (
            <FileRow
              key={j.id}
              ext={extLabel(j.name)}
              name={j.name}
              detail={
                j.status === 'failed'
                  ? s.errors[j.error ?? 'UP_FORMAT']
                  : `${extLabel(j.name)} · ${j.sizeMb} MB`
              }
              detailTone={j.status === 'failed' ? 'danger' : 'textMuted'}
              tone={j.status === 'failed' ? 'danger' : 'default'}
              trailing={
                <View style={styles.row}>
                  <Chip label={label(j)} tone={jobTone(j)} />
                  {j.status === 'failed' ? (
                    <IconButton
                      icon="x"
                      label={s.uploadProblems.dismiss}
                      onPress={() => removeUpload(j.id)}
                    />
                  ) : null}
                </View>
              }
            />
          ))}
        </>
      )}
      {plan.length > 0 ? (
        <Card>
          <View style={styles.row}>
            <Icon name="star" size={14} color="primary" />
            <Text variant="smallStrong" style={styles.flex}>
              {s.upload.planTitle}
            </Text>
            <TextLink label={s.upload.edit} onPress={() => router.push('/upload/review')} />
          </View>
          <View style={styles.crumbs}>
            {plan.map((p, i) => (
              <View key={p} style={styles.row}>
                {i > 0 ? <Icon name="chevron-right" size={12} color="textMuted" /> : null}
                <Chip label={p} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  drop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  dropIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  flex: { flex: 1 },
  center: { alignItems: 'center', marginTop: -space.sm },
});
