import { previewOnly } from '@/components/domain/PreviewOnly';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Banner,
  Sheet,
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
  dailyQuestionLimit,
  questionsToday,
  quotaMb,
  usedMb,
  useStore,
} from '@/store/store';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 38 · Gestionar suscripción; `?demo=restore-failed` muestra el estado 49. */
function Subscription() {
  const s = useStrings();
  const sub = s.subscription;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const plan = useStore((st) => st.plan);
  const used = useStore(usedMb);
  const quota = useStore(quotaMb);
  const asked = useStore(questionsToday);
  const limit = useStore(dailyQuestionLimit);
  const payments = useStore((st) => st.payments);
  const [sheet, setSheet] = useState<'payment' | 'history' | null>(null);
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
          <Text variant="caption">{`${used} / ${quota} MB · ${asked} / ${limit}`}</Text>
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
      <Card>
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
          onPress={() => setSheet('payment')}
        />
        <ListRow
          icon="refresh-cw"
          title={sub.restore}
          onPress={() => router.push('/profile/subscription?demo=restore-failed')}
        />
        <ListRow icon="clock" title={sub.history} onPress={() => setSheet('history')} />
        <ListRow
          icon="external-link"
          title={sub.cancel}
          danger
          divider={false}
          onPress={() => choosePlan('free')}
        />
      </Card>
      <View style={styles.note}>
        <Icon name="shield" size={14} color="textMuted" />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {sub.storeNote}
        </Text>
      </View>
      <View style={styles.links}>
        <TextLink
          label={sub.terms}
          variant="caption"
          onPress={() => router.push('/legal/subscription')}
        />
        <TextLink
          label={s.common.privacyPolicy}
          variant="caption"
          onPress={() => router.push('/legal/privacy')}
        />
      </View>
      <Sheet
        visible={sheet === 'payment'}
        onClose={() => setSheet(null)}
        title={s.sheets.paymentTitle}
      >
        <Banner
          tone="info"
          icon="credit-card"
          title={plans.paymentMethod}
          body={s.sheets.paymentBody}
        />
      </Sheet>
      <Sheet
        visible={sheet === 'history'}
        onClose={() => setSheet(null)}
        title={s.sheets.historyTitle}
      >
        {payments.length === 0 ? (
          <Text variant="small" color="textMuted">
            {s.sheets.historyEmpty}
          </Text>
        ) : (
          payments.map((pay, idx) => (
            <ListRow
              key={pay.id}
              icon="check-circle"
              title={`${pay.plan} · ${pay.amount}`}
              detail={pay.date}
              divider={idx < payments.length - 1}
            />
          ))
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  list: { padding: 0, gap: 0 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  links: { flexDirection: 'row', gap: space.xl },
});

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(Subscription);
