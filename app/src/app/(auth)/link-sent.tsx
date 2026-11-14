import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/domain/AuthLayout';
import { Button, Text, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';
import { formatCountdown } from '@/lib/format';
import { requestPasswordReset, resendSignupEmail } from '@/store/store';

const RESEND_SECONDS = 42;

/** Pantalla 13 · Enlace enviado */
export default function LinkSent() {
  const s = useStrings();
  const { email = '', mode = 'reset' } = useLocalSearchParams<{
    email?: string;
    mode?: 'reset' | 'signup';
  }>();
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <AuthLayout
      title={s.linkSent.title}
      subtitle={s.linkSent.body(email)}
      header={<TopBar />}
      mood="happy"
    >
      <Button
        label={s.linkSent.openMail}
        onPress={() => void Linking.openURL('mailto:').catch(() => undefined)}
      />
      <Button
        label={left > 0 ? s.linkSent.resendIn(formatCountdown(left)) : s.linkSent.resend}
        variant="secondary"
        disabled={left > 0}
        onPress={() => {
          setLeft(RESEND_SECONDS);
          void (mode === 'signup' ? resendSignupEmail(email) : requestPasswordReset(email));
        }}
      />
      <View style={styles.inline}>
        <Text variant="small" color="textMuted">
          {s.linkSent.wrongEmail}
        </Text>
        <TextLink label={s.common.change} onPress={() => router.back()} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
