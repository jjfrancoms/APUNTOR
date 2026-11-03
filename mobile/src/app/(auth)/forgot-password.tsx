import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Mascot, Screen, Text, TextField, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 12 · Recuperar contraseña */
export default function ForgotPassword() {
  const s = useStrings();
  const [email, setEmail] = useState('');
  return (
    <Screen
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
        placeholder="ana@correo.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Button
        label={s.forgot.submit}
        onPress={() =>
          router.push({ pathname: '/link-sent', params: { email: email || 'ana@correo.com' } })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  intro: { gap: space.xs },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
