import { router } from 'expo-router';
import { previewOnly } from '@/components/domain/PreviewOnly';
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

/**
 * Pantalla 41 · Idioma no compatible (código provisional UP_LANGUAGE). Aún no hay detector real de
 * idioma: solo se ve en la vista previa del diseño.
 */
function UnsupportedLanguage() {
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
        name={job?.name ?? s.language.sampleFile}
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
          {s.language.detected(s.language.sampleLanguage)}
        </Text>
        <TextLink label={s.uploadProblems.chooseOther} onPress={() => router.replace('/upload')} />
      </FileRow>
      <Card>
        <Text variant="smallStrong" accessibilityRole="header">
          {s.language.supported}
        </Text>
        <View style={styles.chips}>
          <Chip label={s.language.spanish} tone="primary" icon="check" />
          <Chip label={s.language.english} tone="primary" icon="check" />
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

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta que exista el detector.
export default previewOnly(UnsupportedLanguage);

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm },
  flat: { padding: 0 },
});
