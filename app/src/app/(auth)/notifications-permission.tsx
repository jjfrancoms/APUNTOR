import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Mascot, Screen, Text, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { updateSettings } from '@/store/store';
import { space, useTheme } from '@/theme';

/** Pantalla 33 · Permiso de notificaciones */
export default function NotificationsPermission() {
  const s = useStrings();
  const { c } = useTheme();
  const done = () => router.replace('/home');
  const enable = () => {
    updateSettings({ notifProcessed: true, notifReview: true });
    done();
  };
  const skip = () => {
    updateSettings({ notifProcessed: false, notifReview: false, notifLimit: false });
    done();
  };
  return (
    <Screen
      narrow
      header={<TopBar icon="x" onBack={done} />}
      footer={
        <>
          <Button label={s.notificationsPermission.enable} onPress={enable} />
          <View style={styles.center}>
            <TextLink label={s.notificationsPermission.notNow} color="textMuted" onPress={skip} />
          </View>
        </>
      }
    >
      <View style={styles.hero}>
        <Mascot size={96} mood="surprised" />
        <Text variant="title" align="center" accessibilityRole="header">
          {s.notificationsPermission.title}
        </Text>
        <Text variant="small" color="textMuted" align="center">
          {s.notificationsPermission.subtitle}
        </Text>
      </View>
      <Card style={styles.list}>
        {s.notificationsPermission.items.map((item, i) => (
          <View
            key={item.title}
            style={[
              styles.item,
              i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={[styles.check, { backgroundColor: c.primarySoft }]}>
              <Icon name="check" size={14} color="primary" />
            </View>
            <View style={styles.flex}>
              <Text variant="smallStrong">{item.title}</Text>
              <Text variant="caption" color="textMuted">
                {item.detail}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm },
  list: { padding: 0, gap: 0 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
});
