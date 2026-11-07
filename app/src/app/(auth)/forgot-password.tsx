import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Mascot, Screen, Text, TextField, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { isValidEmail } from '@/lib/validation';
import { requestPasswordReset } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 12 · Recuperar contraseña */
export default function ForgotPassword() {
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const send = async () => {
    setBusy(true);
    const ok = await requestPasswordReset(email);
    setBusy(false);
    setFailed(!ok);
    if (ok) router.push({ pathname: '/link-sent', params: { email: email.trim(), mode: 'reset' } });
  };
  return (
    <Screen
      narrow
      header={<TopBar title={s.forgot.header} />}
      footer={
        <View style={styles.inline}>
          <Text variant="small" color="textMuted">
            {s.forgot.remembered}
          </Text>
          <TextLink label={s.forgot.backToLogin} onPress={() => router.replace('/login')} />
        </View>
      }
    >
      <View style={styles.center}>
        <Mascot size={96} mood="curious" />
      </View>
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          {s.forgot.title}
        </Text>
        <Text variant="small" color="textMuted">
          {s.forgot.subtitle}
        </Text>
      </View>
      <TextField
        label={s.forgot.email}
        placeholder={s.login.emailPlaceholder}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={failed ? s.errors.NET_UNAVAILABLE : undefined}
      />
      <Button
        label={s.forgot.submit}
        disabled={!isValidEmail(email)}
        loading={busy}
        onPress={() => void send()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  intro: { gap: space.xs },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
