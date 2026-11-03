import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Checkbox, Screen, Text, TextField, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { isWeakPassword } from '@/lib/validation';
import { space, useTheme } from '@/theme';

/** Pantalla 11 · Registro */
export default function Register() {
  const s = useStrings();
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const weak = submitted && isWeakPassword(password);
  const submit = () => {
    setSubmitted(true);
    if (!isWeakPassword(password) && accepted) router.push('/privacy');
  };
  return (
    <Screen header={<TopBar title={s.register.header} />}>
      <View style={styles.intro}>
        <Text variant="title" accessibilityRole="header">
          {s.register.title}
        </Text>
        <Text variant="small" color="textMuted">
          {s.register.subtitle}
        </Text>
      </View>
      <TextField
        label={s.register.name}
        placeholder={s.register.namePlaceholder}
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
      <TextField
        label={s.register.email}
        placeholder={s.register.emailPlaceholder}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextField
        label={s.register.password}
        placeholder={s.register.passwordPlaceholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={weak ? s.errors.AUTH_WEAK_PASSWORD : undefined}
      />
      <Checkbox
        checked={accepted}
        onChange={setAccepted}
        label={`${s.register.accept} ${s.common.terms} ${s.common.and} ${s.common.privacyPolicy}`}
      >
        <Text variant="caption" color="textMuted">
          {s.register.accept}{' '}
          <Text variant="caption" color="primary">
            {s.common.terms}
          </Text>{' '}
          {s.common.and}{' '}
          <Text variant="caption" color="primary">
            {s.common.privacyPolicy}
          </Text>
        </Text>
      </Checkbox>
      <Button label={s.register.submit} onPress={submit} disabled={!accepted} />
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text variant="caption" color="textMuted">
          {s.common.or}
        </Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>
      <Button label={s.common.google} variant="secondary" />
      <Button label={s.common.apple} variant="secondary" />
      <View style={styles.inline}>
        <Text variant="small" color="textMuted">
          {s.register.haveAccount}
        </Text>
        <TextLink label={s.register.signIn} onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.xs },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
