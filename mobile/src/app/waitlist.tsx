import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { joinWaitlist } from '@/store/store';
import { space } from '@/theme';

/** Pantalla 44 · Lista de espera para menores de 18 (bloqueante legal). */
export default function Waitlist() {
  const s = useStrings();
  const w = s.waitlist;
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(true);
  const [joined, setJoined] = useState(false);
  return (
    <Screen
      header={<TopBar />}
      footer={
        <>
          <Button
            label={w.join}
            disabled={joined || !consent || !isValidEmail(email)}
            onPress={() => {
              joinWaitlist(email);
              setJoined(true);
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  inline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs },
});
