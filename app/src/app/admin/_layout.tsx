import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import { useStore } from '@/store/store';
import { space, useTheme } from '@/theme';

/**
 * Panel de administración (pantallas 59–62). Solo entra quien el servidor reconoce como
 * administrador (`GET /v1/admin/me`); el resto vuelve a Inicio. La API valida cada petición
 * de nuevo: esta protección solo evita mostrar un panel vacío.
 */
export default function AdminLayout() {
  const s = useStrings();
  const { c } = useTheme();
  const hasSession = useStore((st) => st.session !== null);
  const isAdmin = useStore((st) => st.isAdmin);
  const checking = useStore((st) => st.adminChecking);
  if (!PREVIEW) {
    if (hasSession && checking && !isAdmin) {
      return (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={s.admin.checking}
          style={[styles.center, { backgroundColor: c.bg }]}
        >
          <ActivityIndicator color={c.primary} />
          <Text variant="small" color="textMuted">
            {s.admin.checking}
          </Text>
        </View>
      );
    }
    if (!isAdmin) return <Redirect href="/home" />;
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
});
