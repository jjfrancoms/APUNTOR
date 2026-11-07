import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GoogleSignIn } from '@/components/domain/GoogleSignIn';
import { Banner, Button, Icon, Mascot, Screen, Text, TextField, TextLink } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { backendConfigured } from '@/lib/config';
import { entryRoute, getState, signIn } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 1 · Inicio de sesión */
export default function Login() {
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    // Sin la mayoría de edad confirmada en la cuenta, se pide antes de entrar.
    if (r.ok) router.replace(entryRoute(getState()));
    else setError(s.errors[r.error]);
  };
  return (
    <Screen narrow>
      <View style={styles.hero}>
        <Mascot size={110} halo />
        <Text variant="title" align="center" accessibilityRole="header">
          {s.login.title}
        </Text>
        <Text variant="small" color="textMuted" align="center">
          {s.login.subtitle}
        </Text>
      </View>
      {backendConfigured ? null : <Banner tone="warning" title={s.live.notConfigured} />}
      <TextField
        label={s.login.email}
        placeholder={s.login.emailPlaceholder}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextField
        label={s.login.password}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={() => void submit()}
        error={error}
      />
      <View style={styles.right}>
        <TextLink label={s.login.forgot} onPress={() => router.push('/forgot-password')} />
      </View>
      <View style={styles.actions}>
        <Button
          label={s.login.submit}
          onPress={() => void submit()}
          loading={busy}
          disabled={email.length === 0 || password.length === 0}
        />
        <GoogleSignIn />
      </View>
      <View style={styles.inline}>
        <Text variant="small" color="textMuted">
          {s.login.firstTime}
        </Text>
        <TextLink label={s.login.createAccount} onPress={() => router.push('/register')} />
      </View>
      <View style={styles.inline}>
        <Icon name="lock" size={12} color="textMuted" />
        <Text variant="caption" color="textMuted">
          {s.login.privacyNote}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.lg },
  right: { alignItems: 'flex-end', marginTop: -space.sm },
  actions: { gap: space.sm },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
