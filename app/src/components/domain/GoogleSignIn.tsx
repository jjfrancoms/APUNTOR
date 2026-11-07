import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { GOOGLE_AUTH } from '@/lib/config';
import { signInWithGoogle } from '@/store/store';
import { space, useTheme } from '@/theme';

/**
 * "Continuar con Google" (Inicio de sesión y Registro). Solo aparece con
 * EXPO_PUBLIC_GOOGLE_AUTH=1, cuando el proveedor ya está configurado en Supabase.
 */
export function GoogleSignIn() {
  const s = useStrings();
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  if (!GOOGLE_AUTH) return null;
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await signInWithGoogle();
    if (r.ok) {
      // En web la pestaña ya va hacia Google: se queda cargando hasta salir.
      if (r.next === null) return;
      setBusy(false);
      router.replace(r.next);
      return;
    }
    setBusy(false);
    // error null = la persona cerró el navegador: no es un error que mostrar.
    if (r.error) setError(r.error);
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text variant="caption" color="textMuted">
          {s.common.or}
        </Text>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>
      <Button
        label={s.common.google}
        variant="secondary"
        loading={busy}
        onPress={() => void start()}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {s.errors[error]}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
