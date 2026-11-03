import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Checkbox,
  Icon,
  ListRow,
  Screen,
  Text,
  TextLink,
  Toggle,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 15 · Privacidad y consentimiento */
export default function Privacy() {
  const s = useStrings();
  const [useDocs, setUseDocs] = useState(true);
  const [external, setExternal] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [accepted, setAccepted] = useState(true);
  return (
    <Screen
      header={<TopBar title={s.privacy.header} />}
      footer={
        <>
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label={`${s.privacy.readAndAccept} ${s.common.terms} ${s.common.and} ${s.common.privacyPolicy}`}
          >
            <Text variant="caption" color="textMuted">
              {s.privacy.readAndAccept}{' '}
              <Text variant="caption" color="primary">
                {s.common.terms}
              </Text>{' '}
              {s.common.and}{' '}
              <Text variant="caption" color="primary">
                {s.common.privacyPolicy}
              </Text>
            </Text>
          </Checkbox>
          {/* "Usar mis documentos" es necesario para que la app funcione. */}
          <Button
            label={s.privacy.submit}
            disabled={!accepted || !useDocs}
            onPress={() => router.push('/onboarding')}
          />
          <Button label={s.privacy.fullPolicy} variant="secondary" />
        </>
      }
    >
      <Text variant="small" color="textMuted">
        {s.privacy.intro}
      </Text>
      <Card style={styles.list}>
        <ListRow
          title={s.privacy.useDocs.title}
          detail={s.privacy.useDocs.detail}
          trailing={
            <Toggle value={useDocs} onChange={setUseDocs} label={s.privacy.useDocs.title} />
          }
        />
        <ListRow
          title={s.privacy.external.title}
          detail={s.privacy.external.detail}
          trailing={
            <Toggle value={external} onChange={setExternal} label={s.privacy.external.title} />
          }
        />
        <ListRow
          title={s.privacy.analytics.title}
          detail={s.privacy.analytics.detail}
          divider={false}
          trailing={
            <Toggle value={analytics} onChange={setAnalytics} label={s.privacy.analytics.title} />
          }
        />
      </Card>
      <Card tone="accent">
        <View style={styles.row}>
          <Icon name="shield" size={16} />
          <Text variant="smallStrong">{s.privacy.minorTitle}</Text>
        </View>
        <Text variant="caption">{s.privacy.minorBody}</Text>
        {/* Mapa: 15 Privacidad → 44 Lista de espera (menores de 18). */}
        <TextLink label={s.privacy.minorAction} onPress={() => router.push('/waitlist')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
