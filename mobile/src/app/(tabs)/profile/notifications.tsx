import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Banner, Card, ListRow, Screen, Text, TextLink, Toggle, TopBar } from '@/components/ui';
import { plans } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { space } from '@/theme';

/** Pantalla 34 · Ajustes de notificaciones (incluye el estado de permiso denegado). */
export default function NotificationSettings() {
  const s = useStrings();
  const n = s.notificationSettings;
  const [processed, setProcessed] = useState(true);
  const [review, setReview] = useState(true);
  const [limit, setLimit] = useState(false);
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
            onPress={() => undefined}
            trailing={
              <View style={styles.row}>
                <Text variant="smallStrong" color="primary">
                  {plans.reviewTime}
                </Text>
              </View>
            }
          />
        </Card>
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
