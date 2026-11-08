import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Checkbox,
  Mascot,
  Screen,
  Text,
  TextField,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { isValidEmail } from '@/lib/validation';
import { joinWaitlist, type WaitlistResult } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 44 · Lista de espera para menores de 18 (bloqueante legal). */
export default function Waitlist() {
  const s = useStrings();
  const w = s.waitlist;
  const [email, setEmail] = useState('');
  // Sin marcar: el consentimiento tiene que ser un acto expreso.
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WaitlistResult | null>(null);
  const joined = result === 'ok';
  return (
    <Screen
      narrow
      header={<TopBar />}
      footer={
        <>
          <Button
            label={w.join}
            loading={sending}
            disabled={joined || !consent || !isValidEmail(email)}
            onPress={() => {
              setSending(true);
              setResult(null);
              void joinWaitlist(email, consent, Platform.OS === 'web' ? 'web' : 'app').then((r) => {
                setSending(false);
                setResult(r);
                // El correo ya está en el servidor: no se queda en la pantalla.
                if (r === 'ok') setEmail('');
              });
            }}
          />
          <View style={styles.inline}>
            <Text variant="small" color="textMuted">
              {w.wrongAge}
            </Text>
            <TextLink label={w.fix} onPress={() => router.replace('/privacy')} />
          </View>
        </>
      }
    >
      <View style={styles.hero}>
        <Mascot size={110} />
        <Text variant="title" align="center" accessibilityRole="header">
          {w.title}
        </Text>
        <Text variant="small" color="textMuted" align="center">
          {w.body}
        </Text>
      </View>
      <TextField
        label={w.email}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder={w.emailPlaceholder}
      />
      <Checkbox checked={consent} onChange={setConsent} label={w.consent}>
        <Text variant="caption" color="textMuted">
          {w.consent}
        </Text>
      </Checkbox>
      {joined ? <Banner tone="info" icon="check" title={w.joined} /> : null}
      {result !== null && result !== 'ok' ? <Banner tone="danger" title={w[result]} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
