import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/domain/AuthLayout';
import { Banner, Text, TextLink, TopBar } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import { completeAuthCode, entryRoute, getState } from '@/store/store';

function single(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Pantalla 57 · Regreso de Google
 * Supabase vuelve aquí con `?code=` tras elegir la cuenta de Google y también desde el enlace
 * que confirma el correo del registro (`emailRedirectTo`). En web se completa la sesión en esta
 * pantalla; en el teléfono, con Google, la completa el inicio de sesión que abrió el navegador,
 * y si el enlace también llega aquí, el mismo código no se cambia dos veces.
 */
export default function AuthCallback() {
  const s = useStrings();
  const a = s.authCallback;
  const params = useLocalSearchParams<{ code?: string; sb_flow_id?: string; error?: string }>();
  const code = single(params.code);
  const flowId = single(params.sb_flow_id);
  const providerError = single(params.error);
  const [error, setError] = useState<ErrorCode | null>(null);

  useEffect(() => {
    if (PREVIEW) return;
    if (!code) {
      // Canceló en Google: vuelve al inicio de sesión. Con sesión abierta, sigue su camino.
      if (providerError === 'access_denied') router.replace('/login');
      else if (getState().session) router.replace(entryRoute(getState()));
      else setError('AUTH_CALLBACK_FAILED');
      return;
    }
    let active = true;
    // El mismo código sirve para Google y para la confirmación del correo.
    void completeAuthCode(code, flowId, 'AUTH_CALLBACK_FAILED').then((res) => {
      if (!active) return;
      if (res.ok) router.replace(res.next);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [code, flowId, providerError]);

  return (
    <AuthLayout title={a.header} header={<TopBar />} mood={error ? 'worried' : 'curious'}>
      {error ? (
        <>
          <Banner tone="danger" title={s.errors[error]} />
          <View style={styles.start}>
            <TextLink label={a.backToLogin} onPress={() => router.replace('/login')} />
          </View>
        </>
      ) : (
        <Text variant="small" color="textMuted" accessibilityRole="alert">
          {a.opening}
        </Text>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start' },
});
