import { Linking, StyleSheet, View } from 'react-native';
import {
  Banner,
  Card,
  ListRow,
  Screen,
  SelectField,
  Text,
  TextLink,
  Toggle,
  TopBar,
} from '@/components/ui';
import { setReviewTime, updateSettings, useStore } from '@/store/store';
import { es, useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 34 · Ajustes de notificaciones (incluye el estado de permiso denegado). */
export default function NotificationSettings() {
  const s = useStrings();
  const n = s.notificationSettings;
  const st = useStore((x) => x.settings);
  const [processed, review, limit] = [st.notifProcessed, st.notifReview, st.notifLimit];
  const setProcessed = (v: boolean) => updateSettings({ notifProcessed: v });
  const setReview = (v: boolean) => updateSettings({ notifReview: v });
  const setLimit = (v: boolean) => updateSettings({ notifLimit: v });
  return (
    <Screen header={<TopBar title={n.header} />}>
      <Banner tone="warning" icon="bell" title={n.deniedTitle} body={n.deniedBody}>
        <TextLink label={n.openSettings} onPress={() => void Linking.openSettings()} />
      </Banner>
      <Card style={styles.list}>
        <ListRow
          title={n.processed.title}
          detail={n.processed.detail}
          trailing={<Toggle value={processed} onChange={setProcessed} label={n.processed.title} />}
        />
        <ListRow
          title={n.review.title}
          detail={n.review.detail}
          trailing={<Toggle value={review} onChange={setReview} label={n.review.title} />}
        />
        <ListRow
          title={n.limit.title}
          detail={n.limit.detail}
          divider={false}
          trailing={<Toggle value={limit} onChange={setLimit} label={n.limit.title} />}
        />
      </Card>
      {review ? (
        <SelectField
          label={n.reviewTime}
          // El valor guardado es el de es.ts; la etiqueta, la del idioma elegido.
          options={es.sheets.times.map((t, i) => ({ value: t, label: s.sheets.times[i] ?? t }))}
          selected={st.reviewTime}
          onSelect={setReviewTime}
        />
      ) : null}
      <Text variant="caption" color="textMuted">
        {n.note}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
