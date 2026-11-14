import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/domain/AuthLayout';
import { Banner, Button, Checkbox, Text, TextLink, Toggle, TopBar } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { acceptLegalDocuments, updateSettings, useStore } from '@/store/store';
import { space, useTheme } from '@/theme';

/** Pantalla 15 · Privacidad y consentimiento */
export default function Privacy() {
  const s = useStrings();
  const { c } = useTheme();
  const settings = useStore((st) => st.settings);
  const useDocs = settings.useDocs;
  const external = settings.external;
  const setUseDocs = (v: boolean) => updateSettings({ useDocs: v });
  const setExternal = (v: boolean) => updateSettings({ external: v });
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
  const rule = { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth };
  return (
    <AuthLayout
      title={s.privacy.header}
      subtitle={s.privacy.intro}
      header={<TopBar />}
      mood="curious"
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
      <View>
        <Toggle
          value={useDocs}
          onChange={setUseDocs}
          label={s.privacy.useDocs.title}
          title={s.privacy.useDocs.title}
          description={s.privacy.useDocs.detail}
        />
        <View style={[styles.second, rule]}>
          <Toggle
            value={external}
            onChange={setExternal}
            label={s.privacy.external.title}
            title={s.privacy.external.title}
            description={s.privacy.external.detail}
          />
        </View>
      </View>
      {/* Aviso para menores: sección simple con línea fina, sin recuadro de color. */}
      <View style={[styles.minor, rule]}>
        <Text variant="smallStrong">{s.privacy.minorTitle}</Text>
        <Text variant="small" color="textMuted">
          {s.privacy.minorBody}
        </Text>
        {/* Mapa: 15 Privacidad → 44 Lista de espera (menores de 18). */}
        <View style={styles.start}>
          <TextLink label={s.privacy.minorAction} onPress={() => router.push('/waitlist')} />
        </View>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  second: { marginTop: space.md, paddingTop: space.md },
  minor: { gap: space.xs, paddingTop: space.lg },
  start: { alignItems: 'flex-start' },
});
