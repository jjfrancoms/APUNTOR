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
import { useStrings, type ErrorCode } from '@/i18n/es';
import { extLabel } from '@/lib/upload-rules';
import {
  quotaMb,
  removeUpload,
  retryUpload,
  usedMb,
  useStore,
  type UploadJob,
} from '@/store/store';

/** Pantalla 18 · Subida con problemas: cada error con su motivo (código) y su acción. */
export default function UploadProblems() {
  const s = useStrings();
  const p = s.uploadProblems;
  const uploads = useStore((st) => st.uploads);
  const used = useStore(usedMb);
  const quota = useStore(quotaMb);
  const failed = uploads.filter((u) => u.status === 'failed');
  const ok = uploads.filter((u) => u.status !== 'failed' && u.status !== 'done').length;

  const detail = (
    code: ErrorCode,
    job: UploadJob,
  ): { title: string; body: string; action: string; onPress: () => void } => {
    switch (code) {
      case 'UP_SIZE':
        return {
          title: p.sizeTitle,
          body: p.sizeBody(job.sizeMb),
          action: p.remove,
          onPress: () => removeUpload(job.id),
        };
      case 'UP_NETWORK':
        return {
          title: p.networkTitle,
          body: p.networkBody,
          action: p.retry,
          onPress: () => retryUpload(job.id),
        };
      case 'UP_UNREADABLE':
        return {
          title: p.unreadableTitle,
          body: p.unreadableBody,
          action: p.retry,
          onPress: () => retryUpload(job.id),
        };
      case 'UP_QUOTA':
        return {
          title: s.errors.UP_QUOTA,
          body: p.spaceValue(used, quota),
          action: p.seePlans,
          onPress: () => router.push('/plans'),
        };
      case 'UP_LANGUAGE':
        return {
          title: s.language.title,
          body: s.language.detected('un idioma no compatible'),
          action: p.chooseOther,
          onPress: () => router.push('/upload/language'),
        };
      default:
        return {
          title: p.formatTitle,
          body: p.formatBody,
          action: p.chooseOther,
          onPress: () => router.push('/upload'),
        };
    }
  };

  return (
    <Screen
      header={<TopBar title={p.header} />}
      footer={
        <Button
          label={p.retryFailed}
          disabled={failed.length === 0}
          onPress={() => {
            failed.forEach((f) => retryUpload(f.id));
            router.replace('/upload/progress');
          }}
        />
      }
    >
      {failed.length > 0 ? (
        <Banner tone="danger" title={p.title(failed.length)} body={p.saved(ok)} />
      ) : (
        <Banner tone="info" icon="check" title={s.demo.uploadsDone} />
      )}
      {failed.map((job) => {
        const d = detail(job.error ?? 'UP_FORMAT', job);
        return (
          <FileRow
            key={job.id}
            tone="danger"
            ext={extLabel(job.name)}
            name={job.name}
            detail={d.title}
            detailTone="danger"
            trailing={
              <IconButton icon="x" label={p.dismiss} onPress={() => removeUpload(job.id)} />
            }
          >
            <Text variant="caption" color="textMuted">
              {d.body}
            </Text>
            <TextLink label={d.action} onPress={d.onPress} />
          </FileRow>
        );
      })}
      <Card tone="accent">
        <View style={styles.row}>
          <Text variant="smallStrong" style={styles.flex}>
            {p.space}
          </Text>
          <Text variant="smallStrong">{p.spaceValue(used, quota)}</Text>
        </View>
        <ProgressBar value={used / quota} tone="accent" label={p.space} />
        <TextLink label={p.seePlans} onPress={() => router.push('/plans')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
