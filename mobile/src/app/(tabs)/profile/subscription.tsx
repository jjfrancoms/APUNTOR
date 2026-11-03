import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { plans } from '@/data/mock';
import {
  choosePlan,
  FREE_DAILY_QUESTIONS,
  questionsToday,
  quotaMb,
  usedMb,
  useStore,
} from '@/store/store';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 38 · Gestionar suscripción; `?demo=restore-failed` muestra el estado 49. */
export default function Subscription() {
  const s = useStrings();
  const sub = s.subscription;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const plan = useStore((st) => st.plan);
  const used = useStore(usedMb);
  const quota = useStore(quotaMb);
  const asked = useStore(questionsToday);
  if (demo === 'restore-failed') {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {sub.header}
        </Text>
        <EmptyState
          mood="worried"
          title={s.empty.restoreTitle}
          body={s.empty.restoreBody}
          primary={{ label: s.empty.retry, onPress: () => router.replace('/profile/subscription') }}
          secondary={{
            label: s.empty.contactSupport,
            onPress: () => router.push('/profile/contact'),
          }}
        />
      </Screen>
    );
  }
  // Sin plan pago: la tabla de estados indica mostrar Planes (26).
  if (plan === 'free') {
    return (
      <Screen
        header={<TopBar title={sub.header} />}
        footer={<Button label={s.demo.upgrade} onPress={() => router.push('/plans')} />}
      >
        <Card>
          <View style={styles.row}>
            <Text variant="heading" style={styles.flex}>
              {s.plans.free}
            </Text>
            <Chip label={sub.active} tone="primary" icon="check" />
          </View>
          <Text variant="caption" color="textMuted">
            {s.demo.freePlanBody}
          </Text>
          <Text variant="caption">{`${used} / ${quota} MB · ${asked} / ${FREE_DAILY_QUESTIONS}`}</Text>
        </Card>
        <Card style={styles.list}>
          <ListRow
            icon="refresh-cw"
            title={sub.restore}
            divider={false}
            onPress={() => router.push('/profile/subscription?demo=restore-failed')}
          />
        </Card>
      </Screen>
    );
  }
  return (
    <Screen header={<TopBar title={sub.header} />}>
      <Card tone="primary">
        <View style={styles.row}>
          <Text variant="heading" style={styles.flex}>
            {s.plans.student}
          </Text>
          <Chip label={sub.active} tone="primary" icon="check" />
        </View>
        <Text variant="smallStrong" color="primary">
          {sub.price(plans.studentPrice)}
        </Text>
        <Text variant="caption" color="textMuted">
          {sub.renews(plans.renewDate)}
        </Text>
        {s.plans.studentItems.map((item) => (
          <View key={item} style={styles.row}>
            <Icon name="check" size={14} color="primary" />
            <Text variant="caption">{item}</Text>
          </View>
        ))}
      </Card>
      <Card style={styles.list}>
        <ListRow
          icon="credit-card"
          title={sub.paymentMethod}
          trailing={
            <View style={styles.row}>
              <Text variant="caption" color="textMuted">
                {plans.paymentMethod}
              </Text>
              <Icon name="chevron-right" size={18} color="textMuted" />
            </View>
          }
          onPress={() => undefined}
        />
        <ListRow
          icon="refresh-cw"
          title={sub.restore}
          onPress={() => router.push('/profile/subscription?demo=restore-failed')}
        />
        <ListRow icon="clock" title={sub.history} onPress={() => undefined} />
        <ListRow
          icon="external-link"
          title={sub.cancel}
          danger
          divider={false}
          onPress={() => choosePlan('free')}
        />
      </Card>
      <Card style={styles.note}>
        <Icon name="shield" size={14} color="textMuted" />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {sub.storeNote}
        </Text>
      </Card>
      <View style={styles.links}>
        <TextLink label={sub.terms} variant="caption" />
        <TextLink label={s.common.privacyPolicy} variant="caption" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  list: { padding: 0, gap: 0 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
});
