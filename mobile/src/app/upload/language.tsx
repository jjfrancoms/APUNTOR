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
import { space } from '@/theme';

/** Pantalla 41 · Idioma no compatible (código provisional UP_LANGUAGE). */
export default function UnsupportedLanguage() {
  const s = useStrings();
  return (
    <Screen
      header={<TopBar title={s.uploadProblems.header} />}
      footer={<Button label={s.language.back} onPress={() => router.replace('/upload')} />}
    >
      <FileRow
        tone="danger"
        ext="PDF"
        name="Resumen_chino.pdf"
        detail={s.language.title}
        detailTone="danger"
        trailing={<IconButton icon="x" label={s.uploadProblems.dismiss} />}
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
        <ListRow icon="globe" title={s.language.notify} divider={false} onPress={() => undefined} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: space.sm },
  flat: { padding: 0 },
});
