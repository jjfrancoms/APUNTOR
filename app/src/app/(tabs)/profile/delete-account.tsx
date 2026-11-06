import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Icon,
  ListRow,
  Screen,
  Text,
  TextField,
  TopBar,
} from '@/components/ui';
import * as Clipboard from 'expo-clipboard';
import { deleteAccount, exportUserData, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/**
 * Pantalla 40 · Borrar cuenta. Inmediato y definitivo, con confirmación escrita y contraseña.
 * Estado 52: texto de confirmación incorrecto → error en línea y botón deshabilitado (`?demo=wrong`).
 */
export default function DeleteAccount() {
  const s = useStrings();
  const d = s.deleteAccount;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const [confirm, setConfirm] = useState(demo === 'wrong' ? 'borrar' : '');
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [exported, setExported] = useState(false);
  const documents = useStore((st) => st.documents.length);
  const courses = useStore((st) => st.courses.length);
  const conversations = useStore((st) => st.conversations.length);
  const accountTotals = { documents, courses, conversations };
  const ok = confirm === d.confirmWord;
  const wrong = confirm.length > 0 && !ok;
  return (
    <Screen
      header={<TopBar title={d.header} />}
      footer={
        <>
          <Button
            label={deleting ? d.deleting : d.submit}
            variant="danger"
            loading={deleting}
            disabled={!ok}
            onPress={() => {
              setDeleting(true);
              setFailed(false);
              void deleteAccount().then((done) => {
                setDeleting(false);
                if (done) router.replace('/login');
                else setFailed(true);
              });
            }}
          />
          <Button label={s.common.cancel} variant="secondary" onPress={() => router.back()} />
        </>
      }
    >
      {failed ? <Banner tone="danger" title={s.live.deleteAccountFailed} /> : null}
      <Banner tone="danger" icon="trash-2" title={d.title}>
        {d
          .items(accountTotals.documents, accountTotals.courses, accountTotals.conversations)
          .map((item) => (
            <View key={item} style={styles.row}>
              <Icon name="x" size={12} color="danger" />
              <Text variant="caption">{item}</Text>
            </View>
          ))}
      </Banner>
      <Banner tone="warning" icon="credit-card" title={d.subscription} />
      <Card style={styles.flat}>
        <ListRow
          icon="download"
          title={d.download}
          divider={false}
          onPress={() => {
            void Clipboard.setStringAsync(exportUserData()).then(
              () => setExported(true),
              () => setExported(false),
            );
          }}
        />
      </Card>
      {exported ? <Banner tone="info" icon="check" title={s.sheets.exportDone} /> : null}
      <TextField
        label={d.confirmLabel(d.confirmWord)}
        placeholder={d.confirmWord}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
        error={wrong ? d.confirmError(d.confirmWord) : undefined}
      />
      <Text variant="caption" color="textMuted">
        {d.note}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flat: { padding: 0 },
});
