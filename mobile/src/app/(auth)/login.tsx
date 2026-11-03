import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Mascot, Screen, Text, TextField, TextLink } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { DEMO_EMAIL, DEMO_PASSWORD, signIn, signInWithProvider } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 1 · Inicio de sesión */
export default function Login() {
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    const r = signIn(email, password);
    if (r.ok) router.replace('/home');
    else setError(s.errors[r.error]);
  };
  const provider = () => {
    signInWithProvider();
    router.replace('/home');
  };
  return (
    <Screen>
      <View style={styles.hero}>
        <Mascot size={110} halo />
        <Text variant="title" align="center" accessibilityRole="header">
          {s.login.title}
        </Text>
        <Text variant="small" color="textMuted" align="center">
          {s.login.subtitle}
        </Text>
      </View>
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
        onSubmitEditing={submit}
        error={error}
      />
      <View style={styles.right}>
        <TextLink label={s.login.forgot} onPress={() => router.push('/forgot-password')} />
      </View>
      <View style={styles.actions}>
        <Button
          label={s.login.submit}
          onPress={submit}
          disabled={email.length === 0 || password.length === 0}
        />
        <Button label={s.common.google} variant="secondary" onPress={provider} />
        <Button label={s.common.apple} variant="secondary" onPress={provider} />
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
      <Text variant="caption" color="textMuted" align="center" selectable>
        {s.demo.account(DEMO_EMAIL, DEMO_PASSWORD)}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.lg },
  right: { alignItems: 'flex-end', marginTop: -space.sm },
  actions: { gap: space.sm },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
