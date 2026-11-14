import { router } from 'expo-router';
import { previewOnly } from '@/components/domain/PreviewOnly';
import { AuthLayout } from '@/components/domain/AuthLayout';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TextLink, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { updateSettings } from '@/store/store';
import { space, useTheme } from '@/theme';

/** Pantalla 33 · Permiso de notificaciones. Fase 4: fuera del onboarding, solo en la vista previa. */
function NotificationsPermission() {
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
    <AuthLayout
      title={s.notificationsPermission.title}
      subtitle={s.notificationsPermission.subtitle}
      header={<TopBar icon="x" onBack={done} />}
      mood="surprised"
      footer={
        <>
          <Button label={s.notificationsPermission.enable} onPress={enable} />
          <View style={styles.start}>
            <TextLink label={s.notificationsPermission.notNow} color="textMuted" onPress={skip} />
          </View>
        </>
      }
    >
      {/* Lista plana separada por líneas finas: la marca de verificación no lleva recuadro. */}
      <View>
        {s.notificationsPermission.items.map((item, i) => (
          <View
            key={item.title}
            style={[
              styles.item,
              i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Icon name="check" size={18} color="primary" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="caption" color="textMuted">
                {item.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </AuthLayout>
  );
}

// Las notificaciones aún no existen: en la app real se muestra "Muy pronto".
export default previewOnly(NotificationsPermission);

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  flex: { flex: 1 },
  start: { alignItems: 'flex-start' },
});
