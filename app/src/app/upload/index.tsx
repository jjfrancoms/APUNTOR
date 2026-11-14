import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  FileRow,
  Icon,
  IconButton,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { OfflineBanner } from '@/components/domain/OfflineBanner';
import { useStrings } from '@/i18n/es';
import { pickFiles } from '@/lib/pick-files';
import { extLabel } from '@/lib/upload-rules';
import { failureTitle, jobTone } from '@/lib/upload-view';
import {
  enqueueUploads,
  removeUpload,
  useStore,
  type PickedFile,
  type UploadJob,
} from '@/store/store';
import { layout, radius, space, useTheme, useWide } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 2 · Subir documentos. Valida al elegir; la subida sigue en segundo plano. */
export default function Upload() {
  const s = useStrings();
  const { c } = useTheme();
  const wide = useWide();
  const uploads = useStore((st) => st.uploads);
  const jobs = uploads.filter(
    (u) => u.status !== 'done' && !(u.status === 'review' && u.id.startsWith('up-r')),
  );
  const plan = jobs.find((j) => j.path.length > 0)?.path ?? [];
  const add = (files: PickedFile[]) => {
    if (files.length > 0) enqueueUploads(files);
  };
  // El motivo del error va en la línea de detalle; el chip solo lleva una etiqueta corta.
  const label = (j: UploadJob) =>
    j.status === 'failed'
      ? s.upload.status.unsupported
      : j.status === 'review'
        ? s.upload.status.ready
        : j.status === 'processing'
          ? s.upload.status.analyzing
          : s.upload.status.queued;
  return (
    <Screen
      wide
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
      <OfflineBanner title={s.connection.uploads} />
      <View style={[styles.layout, wide && styles.layoutWide]}>
        <View style={styles.dropCol}>
          <View style={styles.lead}>
            <Text variant="title" accessibilityRole="header">
              {s.upload.lead}
            </Text>
            <Text variant="muted">{s.upload.leadBody}</Text>
          </View>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`${s.upload.dropTitle}. ${s.upload.dropDetail}`}
            onPress={() => void pickFiles().then(add)}
            style={[
              styles.drop,
              { backgroundColor: c.surface, borderColor: c.textMuted },
              wide && styles.dropWide,
            ]}
          >
            <Icon name="upload" size={22} color="primary" />
            <Text variant="bodyStrong">{s.upload.dropTitle}</Text>
            <Text variant="caption" color="textMuted">
              {s.upload.dropDetail}
            </Text>
          </Tap>
        </View>
        <View style={styles.filesCol}>
          {jobs.length === 0 ? (
            <Text variant="small" color="textMuted">
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
                      ? failureTitle(j.error ?? 'UP_FORMAT', s)
                      : `${extLabel(j.name)} · ${j.sizeMb} MB`
                  }
                  detailTone={j.status === 'failed' ? 'danger' : 'textMuted'}
                  tone={j.status === 'failed' ? 'danger' : 'default'}
                  trailing={
                    // Como en la pantalla 18: si falló, motivo corto en rojo y solo la acción de quitar.
                    j.status === 'failed' ? (
                      <IconButton
                        icon="x"
                        label={s.uploadProblems.dismiss}
                        onPress={() => removeUpload(j.id)}
                      />
                    ) : (
                      <Chip label={label(j)} tone={jobTone(j)} />
                    )
                  }
                />
              ))}
              {jobs.some((j) => j.status === 'failed') ? (
                <TextLink
                  label={s.demo.seeProblems}
                  onPress={() => router.push('/upload/problems')}
                />
              ) : null}
            </>
          )}
          {plan.length > 0 ? (
            <View
              style={[
                styles.plan,
                { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.row}>
                <Text variant="smallStrong" style={styles.flex}>
                  {s.upload.planTitle}
                </Text>
                <TextLink label={s.upload.edit} onPress={() => router.push('/upload/review')} />
              </View>
              <Text variant="small" color="textMuted">
                {plan.join(' › ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { gap: space.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  dropCol: { flex: 1, minWidth: 0, gap: space.lg },
  filesCol: { flex: 1, minWidth: 0, gap: space.md },
  lead: { gap: space.xs },
  // Zona de soltar: borde discontinuo sobre la superficie, sin relleno de color.
  drop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    padding: space.xl,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget * 3,
  },
  dropWide: { minHeight: 240 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  plan: { gap: space.xs, paddingTop: space.md },
  flex: { flex: 1 },
});
