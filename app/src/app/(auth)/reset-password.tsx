import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Mascot, Screen, Text, TextField, TextLink, TopBar } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import {
  completeAuthCode,
  entryRoute,
  getState,
  updatePassword,
  type AuthField,
} from '@/store/store';
import { space } from '@/theme';

type Phase = 'opening' | 'ready' | 'failed';

function single(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Pantalla 56 · Nueva contraseña (enlace de recuperación del correo) */
export default function ResetPassword() {
  const s = useStrings();
  const r = s.resetPassword;
  const params = useLocalSearchParams<{ code?: string; sb_flow_id?: string }>();
  const code = single(params.code);
  const flowId = single(params.sb_flow_id);
  // Sin código en el enlace no hay recuperación: con una sesión cualquiera abierta, esta
  // pantalla cambiaría la contraseña sin pedir la actual (eso se hace en Perfil).
  const [phase, setPhase] = useState<Phase>(code ? 'opening' : PREVIEW ? 'ready' : 'failed');
  const [linkError, setLinkError] = useState<ErrorCode>('AUTH_LINK_EXPIRED');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ code: ErrorCode; field: AuthField } | null>(null);
  const [busy, setBusy] = useState(false);

  // Cambia el código del enlace por la sesión de recuperación (una sola vez por código).
  useEffect(() => {
    if (!code) return;
    let active = true;
    void completeAuthCode(code, flowId).then((res) => {
      if (!active) return;
      if (res.ok) setPhase('ready');
      else {
        setLinkError(res.error);
        setPhase('failed');
      }
    });
    return () => {
      active = false;
    };
  }, [code, flowId]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await updatePassword(password, confirm);
    setBusy(false);
    if (res.ok) router.replace(entryRoute(getState()));
    else setError({ code: res.error, field: res.field });
  };

  return (
    <Screen narrow header={<TopBar title={r.header} />}>
      <View style={styles.center}>
        <Mascot size={96} mood={phase === 'failed' ? 'worried' : 'curious'} />
      </View>
      {phase === 'opening' ? (
        <Text variant="small" color="textMuted" align="center" accessibilityRole="alert">
          {r.opening}
        </Text>
      ) : null}
      {phase === 'failed' ? (
        <>
          <Banner tone="danger" title={s.errors[linkError]} />
          <Button label={r.requestNew} onPress={() => router.replace('/forgot-password')} />
          <View style={styles.center}>
            <TextLink label={s.forgot.backToLogin} onPress={() => router.replace('/login')} />
          </View>
        </>
      ) : null}
      {phase === 'ready' ? (
        <>
          <View style={styles.intro}>
            <Text variant="title" accessibilityRole="header">
              {r.title}
            </Text>
            <Text variant="small" color="textMuted">
              {r.subtitle}
            </Text>
          </View>
          <TextField
            label={r.password}
            placeholder={r.passwordPlaceholder}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error?.field === 'password') setError(null);
            }}
            secureTextEntry
            autoComplete="new-password"
            error={error?.field === 'password' ? s.errors[error.code] : undefined}
          />
          <TextField
            label={r.confirm}
            placeholder={r.confirmPlaceholder}
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (error?.field === 'confirm') setError(null);
            }}
            secureTextEntry
            autoComplete="new-password"
            onSubmitEditing={() => void save()}
            error={error?.field === 'confirm' ? s.errors[error.code] : undefined}
          />
          <Button
            label={r.submit}
            loading={busy}
            disabled={password.length === 0 || confirm.length === 0}
            onPress={() => void save()}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  intro: { gap: space.xs },
});
