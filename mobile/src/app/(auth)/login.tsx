import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Mascot, Screen, Text, TextField, TextLink } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 1 · Inicio de sesión */
export default function Login() {
  const s = useStrings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      <View style={styles.right}>
        <TextLink label={s.login.forgot} onPress={() => router.push('/forgot-password')} />
      </View>
      <View style={styles.actions}>
        <Button label={s.login.submit} onPress={() => router.replace('/home')} />
        <Button label={s.common.google} variant="secondary" />
        <Button label={s.common.apple} variant="secondary" />
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
