import { Linking, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import {
  Banner,
  Card,
  Icon,
  ListRow,
  Screen,
  Sheet,
  Text,
  TextLink,
  Toggle,
  TopBar,
} from '@/components/ui';
import { setReviewTime, updateSettings, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 34 · Ajustes de notificaciones (incluye el estado de permiso denegado). */
export default function NotificationSettings() {
  const s = useStrings();
  const n = s.notificationSettings;
  const st = useStore((x) => x.settings);
  const [choosing, setChoosing] = useState(false);
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
        <Card style={styles.list}>
          <ListRow
            icon="clock"
            title={n.reviewTime}
            divider={false}
            onPress={() => setChoosing(true)}
            trailing={
              <View style={styles.row}>
                <Text variant="smallStrong" color="primary">
                  {st.reviewTime}
                </Text>
              </View>
            }
          />
        </Card>
      ) : null}
      <Text variant="caption" color="textMuted">
        {n.note}
      </Text>
      <Sheet visible={choosing} onClose={() => setChoosing(false)} title={s.sheets.chooseTime}>
        {s.sheets.times.map((t, idx) => (
          <ListRow
            key={t}
            title={t}
            divider={idx < s.sheets.times.length - 1}
            trailing={t === st.reviewTime ? <Icon name="check" color="primary" /> : undefined}
            onPress={() => {
              setReviewTime(t);
              setChoosing(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
