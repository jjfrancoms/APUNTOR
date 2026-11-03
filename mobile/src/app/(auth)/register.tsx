import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Checkbox,
  DateField,
  Screen,
  Text,
  TextField,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import type { ErrorCode } from '@/i18n/es';
import { signInWithProvider, signUp, type AuthField } from '@/store/store';
import { space, useTheme } from '@/theme';

/** Pantalla 11 · Registro */
export default function Register() {
  const s = useStrings();
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [accepted, setAccepted] = useState(true);
  const [error, setError] = useState<{ code: ErrorCode; field: AuthField } | null>(null);
  const submit = () => {
    const r = signUp({ fullName: name, email, password, confirm, birthDate });
    if (r.ok) router.push('/privacy');
    // Menores de 18: no se crea la cuenta; la lista de espera explica la versión para colegios.
    else if (r.error === 'AUTH_MINOR') router.replace('/waitlist');
    else setError({ code: r.error, field: r.field });
  };
  const provider = () => {
    signInWithProvider();
    router.replace('/home');
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
        error={error?.field === 'email' ? s.errors[error.code] : undefined}
      />
      <TextField
        label={s.register.password}
        placeholder={s.register.passwordPlaceholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={error?.field === 'password' ? s.errors[error.code] : undefined}
      />
      <TextField
        label={s.register.confirm}
        placeholder={s.register.confirmPlaceholder}
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          if (error?.field === 'confirm') setError(null);
        }}
        secureTextEntry
        autoComplete="new-password"
        error={error?.field === 'confirm' ? s.errors[error.code] : undefined}
      />
      <View style={styles.intro}>
        <DateField
          label={s.register.birthDate}
          placeholder={s.register.birthPlaceholder}
          value={birthDate}
          onChange={(v) => {
            setBirthDate(v);
            if (error?.field === 'birthDate') setError(null);
          }}
          error={error?.field === 'birthDate' ? s.errors[error.code] : undefined}
        />
        <Text variant="caption" color="textMuted">
          {s.register.birthNote}
        </Text>
      </View>
      <Checkbox
        checked={accepted}
        onChange={setAccepted}
        label={`${s.register.accept} ${s.common.terms} ${s.common.and} ${s.common.privacyPolicy}`}
      >
        <Text variant="caption" color="textMuted">
          {s.register.accept}{' '}
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
      <Button
        label={s.register.submit}
        onPress={submit}
        disabled={
          !accepted ||
          email.length === 0 ||
          password.length === 0 ||
          confirm.length === 0 ||
          birthDate.length < 10
        }
      />
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text variant="caption" color="textMuted">
          {s.common.or}
        </Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>
      <Button label={s.common.google} variant="secondary" onPress={provider} />
      <Button label={s.common.apple} variant="secondary" onPress={provider} />
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
