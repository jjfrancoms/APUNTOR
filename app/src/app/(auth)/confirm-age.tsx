import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, DateField, Mascot, Screen, Text, TextLink, TopBar } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import { confirmAdult, signOut, useStore } from '@/store/store';
import { space } from '@/theme';

/**
 * Pantalla 58 · Confirmar mayoría de edad
 * Para quien entró con Google (no pasó por el registro con fecha de nacimiento). Menor de 18 →
 * se cierra la sesión y va a la lista de espera (44); mayor → Privacidad y consentimiento (15).
 */
export default function ConfirmAge() {
  const s = useStrings();
  const k = s.confirmAge;
  const signedIn = useStore((st) => st.session !== null);
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<ErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  if (!signedIn && !PREVIEW) return <Redirect href="/login" />;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const r = await confirmAdult(birthDate);
    setBusy(false);
    if (r.ok) router.replace('/privacy');
    else if (r.error === 'AUTH_MINOR') router.replace('/waitlist');
    else setError(r.error);
  };

  return (
    <Screen narrow header={<TopBar title={k.header} />}>
      <View style={styles.center}>
        <Mascot size={96} mood="curious" />
      </View>
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          {k.title}
        </Text>
        <Text variant="small" color="textMuted">
          {k.subtitle}
        </Text>
      </View>
      <View style={styles.intro}>
        <DateField
          label={k.birthDate}
          placeholder={k.birthPlaceholder}
          value={birthDate}
          onChange={(v) => {
            setBirthDate(v);
            setError(null);
          }}
          error={error ? s.errors[error] : undefined}
        />
        <Text variant="caption" color="textMuted">
          {k.birthNote}
        </Text>
      </View>
      <Button
        label={k.submit}
        loading={busy}
        disabled={birthDate.length < 10}
        onPress={() => void submit()}
      />
      <View style={styles.center}>
        <TextLink
          label={k.signOut}
          onPress={() => void signOut().then(() => router.replace('/login'))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  intro: { gap: space.xs },
});
