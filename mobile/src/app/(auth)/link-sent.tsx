import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Screen, Text, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space, useTheme } from '@/theme';
import { formatCountdown } from '@/lib/format';

const RESEND_SECONDS = 42;

/** Pantalla 13 · Enlace enviado */
export default function LinkSent() {
  const s = useStrings();
  const { c } = useTheme();
  const { email = 'ana@correo.com' } = useLocalSearchParams<{ email?: string }>();
  const [left, setLeft] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <Screen
      header={<TopBar />}
      footer={
        <>
          <Button label={s.linkSent.openMail} />
          <Button
            label={left > 0 ? s.linkSent.resendIn(formatCountdown(left)) : s.linkSent.resend}
            variant="secondary"
            disabled={left > 0}
            onPress={() => setLeft(RESEND_SECONDS)}
          />
          <View style={styles.inline}>
            <Text variant="small" color="textMuted">
              {s.linkSent.wrongEmail}
            </Text>
            <TextLink label={s.common.change} onPress={() => router.back()} />
          </View>
        </>
      }
    >
      <View style={styles.center}>
        <View style={[styles.badge, { backgroundColor: c.primarySoft }]}>
          <Icon name="mail" size={28} color="primary" />
        </View>
        <Text variant="title" align="center" accessibilityRole="header">
          {s.linkSent.title}
        </Text>
        <Text variant="small" color="textMuted" align="center">
          {s.linkSent.body(email)}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
