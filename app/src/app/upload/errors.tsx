import { previewOnly } from '@/components/domain/PreviewOnly';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Chip, FileRow, Screen, Text, TopBar } from '@/components/ui';
import { processResults } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 9 · Error al procesar archivos */
function ProcessErrors() {
  const s = useStrings();
  const ok = processResults.filter((r) => r.result === 'ready').length;
  const failed = processResults.length - ok;
  return (
    <Screen
      header={<TopBar title={s.upload.header} />}
      footer={
        <Button
          label={s.processError.continueWith(ok)}
          onPress={() => router.push('/upload/review')}
        />
      }
    >
      {processResults.map((r) => (
        <FileRow
          key={r.id}
          ext={r.name.split('.').pop()?.toUpperCase().slice(0, 3) ?? ''}
          name={r.name}
          detail={r.kind}
          trailing={
            <Chip
              label={s.upload.status[r.result]}
              tone={r.result === 'ready' ? 'primary' : 'danger'}
            />
          }
        />
      ))}
      <Banner tone="danger" title={s.processError.title(failed)}>
        <Text variant="caption">{`• ${s.processError.blurry('Foto de pizarra.jpg')}`}</Text>
        <Text variant="caption">{`• ${s.processError.zip}`}</Text>
        <View style={styles.actions}>
          <Button
            label={s.uploadProblems.retry}
            compact
            onPress={() => router.push('/upload/scan')}
          />
          <Button
            label={s.uploadProblems.dismiss}
            variant="secondary"
            compact
            onPress={() => router.push('/upload/review')}
          />
        </View>
      </Banner>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(ProcessErrors);
