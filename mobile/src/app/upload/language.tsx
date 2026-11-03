import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  FileRow,
  IconButton,
  ListRow,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { notifyMoreLanguages, removeUpload, useStore } from '@/store/store';
import { Banner } from '@/components/ui';
import { space } from '@/theme';

/** Pantalla 41 · Idioma no compatible (código provisional UP_LANGUAGE). */
export default function UnsupportedLanguage() {
  const s = useStrings();
  const notified = useStore((st) => st.notices.languages);
  // Usa el primer archivo rechazado por idioma, si lo hay; si no, el ejemplo del diseño.
  const job = useStore((st) => st.uploads.find((u) => u.error === 'UP_LANGUAGE'));
  return (
    <Screen
      header={<TopBar title={s.uploadProblems.header} />}
      footer={<Button label={s.language.back} onPress={() => router.replace('/upload')} />}
    >
      <FileRow
        tone="danger"
        ext="PDF"
        name={job?.name ?? 'Resumen_chino.pdf'}
        detail={s.language.title}
        detailTone="danger"
        trailing={
          <IconButton
            icon="x"
            label={s.uploadProblems.dismiss}
            onPress={() => {
              if (job) removeUpload(job.id);
              router.replace('/upload');
            }}
          />
        }
      >
        <Text variant="caption" color="textMuted">
          {s.language.detected('chino')}
        </Text>
        <TextLink label={s.uploadProblems.chooseOther} onPress={() => router.replace('/upload')} />
      </FileRow>
      <Card>
        <Text variant="overline" color="textMuted">
          {s.language.supported}
        </Text>
        <View style={styles.chips}>
          <Chip label="Español" tone="primary" icon="check" />
          <Chip label="English" tone="primary" icon="check" />
        </View>
        <Text variant="caption" color="textMuted">
          {s.language.mixed}
        </Text>
      </Card>
      <Card tone="primary" style={styles.flat}>
        {notified ? (
          <Banner tone="info" icon="check" title={s.sheets.languagesDone} />
        ) : (
          <ListRow
            icon="globe"
            title={s.language.notify}
            divider={false}
            onPress={notifyMoreLanguages}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm },
  flat: { padding: 0 },
});
