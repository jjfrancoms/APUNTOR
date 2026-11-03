import { useLocalSearchParams } from 'expo-router';
import { Banner, Card, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';

type Doc = 'terms' | 'privacy' | 'subscription';

/** Términos, privacidad y suscripción (borradores para el prototipo; requieren revisión legal). */
export default function Legal() {
  const s = useStrings();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: Doc = doc === 'privacy' || doc === 'subscription' ? doc : 'terms';
  const body = {
    terms: s.legal.termsBody,
    privacy: s.legal.privacyBody,
    subscription: s.legal.subscriptionBody,
  }[key];
  return (
    <Screen header={<TopBar title={s.legal[key]} />}>
      <Banner tone="warning" icon="alert-triangle" title={s.legal.draft} />
      <Card>
        {body.map((p) => (
          <Text key={p} variant="body">
            {p}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
