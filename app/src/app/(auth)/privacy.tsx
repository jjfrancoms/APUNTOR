import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Icon,
  ListRow,
  Screen,
  Text,
  TextLink,
  Toggle,
  TopBar,
} from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { acceptLegalDocuments, updateSettings, useStore } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 15 · Privacidad y consentimiento */
export default function Privacy() {
  const s = useStrings();
  const settings = useStore((st) => st.settings);
  const useDocs = settings.useDocs;
  const external = settings.external;
  const analytics = settings.analytics;
  const setUseDocs = (v: boolean) => updateSettings({ useDocs: v });
  const setExternal = (v: boolean) => updateSettings({ external: v });
  const setAnalytics = (v: boolean) => updateSettings({ analytics: v });
  // Consentimiento explícito: la casilla empieza sin marcar.
  const [accepted, setAccepted] = useState(false);
  const signedIn = useStore((st) => st.session !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  /** Con sesión, la aceptación (Términos y Política vigentes) queda registrada en el servidor. */
  const submit = async () => {
    if (busy) return;
    if (signedIn) {
      setBusy(true);
      setError(null);
      const r = await acceptLegalDocuments();
      setBusy(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
    }
    router.push('/onboarding');
  };
  return (
    <Screen
      narrow
      header={<TopBar title={s.privacy.header} />}
      footer={
        <>
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label={`${s.privacy.readAndAccept} ${s.common.terms} ${s.common.and} ${s.common.privacyPolicy}`}
          >
            <Text variant="caption" color="textMuted">
              {s.privacy.readAndAccept}{' '}
              <Text
                variant="caption"
                color="primary"
                accessibilityRole="link"
                onPress={() => router.push('/legal/terms')}
              >
                {s.common.terms}
              </Text>{' '}
              {s.common.and}{' '}
              <Text
                variant="caption"
                color="primary"
                accessibilityRole="link"
                onPress={() => router.push('/legal/privacy')}
              >
                {s.common.privacyPolicy}
              </Text>
            </Text>
          </Checkbox>
          {error ? <Banner tone="danger" title={s.errors[error]} /> : null}
          {/* "Usar mis documentos" es necesario para que la app funcione. */}
          <Button
            label={s.privacy.submit}
            disabled={!accepted || !useDocs}
            loading={busy}
            onPress={() => void submit()}
          />
          <Button
            label={s.privacy.fullPolicy}
            variant="secondary"
            onPress={() => router.push('/legal/privacy')}
          />
        </>
      }
    >
      <Text variant="small" color="textMuted">
        {s.privacy.intro}
      </Text>
      <Card style={styles.list}>
        <ListRow
          title={s.privacy.useDocs.title}
          detail={s.privacy.useDocs.detail}
          trailing={
            <Toggle value={useDocs} onChange={setUseDocs} label={s.privacy.useDocs.title} />
          }
        />
        <ListRow
          title={s.privacy.external.title}
          detail={s.privacy.external.detail}
          trailing={
            <Toggle value={external} onChange={setExternal} label={s.privacy.external.title} />
          }
        />
        <ListRow
          title={s.privacy.analytics.title}
          detail={s.privacy.analytics.detail}
          divider={false}
          trailing={
            <Toggle value={analytics} onChange={setAnalytics} label={s.privacy.analytics.title} />
          }
        />
      </Card>
      <Card tone="accent">
        <View style={styles.row}>
          <Icon name="shield" size={16} />
          <Text variant="smallStrong">{s.privacy.minorTitle}</Text>
        </View>
        <Text variant="caption">{s.privacy.minorBody}</Text>
        {/* Mapa: 15 Privacidad → 44 Lista de espera (menores de 18). */}
        <TextLink label={s.privacy.minorAction} onPress={() => router.push('/waitlist')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
