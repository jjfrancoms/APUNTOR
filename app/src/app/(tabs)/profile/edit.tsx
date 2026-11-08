import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Card, Icon, Screen, Text, TextField, TopBar } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { changePassword, updateProfile, useStore } from '@/store/store';
import { radius, space, useTheme } from '@/theme';

/**
 * Editar perfil (pantalla 54): nombre, correo y contraseña. "Qué estudias" se elige solo al
 * registrarse (onboarding) y aquí se muestra sin poder editarse.
 */
export default function EditProfile() {
  const s = useStrings();
  const e = s.editProfile;
  const { c } = useTheme();
  const session = useStore((st) => st.session);
  const [fullName, setFullName] = useState(session?.fullName ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [error, setError] = useState<ErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<ErrorCode | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const level = s.onboarding.levels[session?.level ?? 'university'];

  const [emailPending, setEmailPending] = useState(false);
  const save = async () => {
    const r = await updateProfile({ fullName, email });
    setSaved(r.ok);
    setEmailPending(r.ok && r.needsConfirmation === true);
    setError(r.ok ? null : r.error);
  };
  const savePassword = async () => {
    const r = await changePassword(current, next, confirm);
    setPwSaved(r.ok);
    setPwError(r.ok ? null : r.error);
    if (r.ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  };
  const clearPw = () => {
    setPwError(null);
    setPwSaved(false);
  };

  return (
    <Screen
      header={<TopBar title={e.header} />}
      footer={
        <Button
          label={e.save}
          onPress={() => void save()}
          disabled={fullName.trim().length === 0}
        />
      }
    >
      {saved ? (
        <Banner
          tone="info"
          icon="check"
          title={emailPending ? s.live.emailChangePending : e.saved}
        />
      ) : null}
      <TextField
        label={e.name}
        value={fullName}
        onChangeText={(v) => {
          setFullName(v);
          setSaved(false);
        }}
        autoComplete="name"
      />
      <TextField
        label={e.email}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setSaved(false);
          setError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={error ? s.errors[error] : undefined}
      />
      <View style={styles.gap}>
        <Text variant="smallStrong">{e.level}</Text>
        <View
          accessibilityLabel={`${e.level}: ${level.title}. ${e.levelLocked}`}
          style={[styles.locked, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
        >
          <View style={styles.flex}>
            <Text variant="body">{level.title}</Text>
            <Text variant="caption" color="textMuted">
              {level.detail}
            </Text>
          </View>
          <Icon name="lock" size={16} color="textMuted" />
        </View>
        <Text variant="caption" color="textMuted">
          {e.levelLocked}
        </Text>
      </View>
      <Text variant="smallStrong" accessibilityRole="header">
        {e.passwordHeader}
      </Text>
      <Card>
        {pwSaved ? <Banner tone="info" icon="check" title={e.passwordChanged} /> : null}
        <TextField
          label={e.current}
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            clearPw();
          }}
          secureTextEntry
          autoComplete="current-password"
          error={pwError === 'AUTH_INVALID' ? e.wrongCurrent : undefined}
        />
        <TextField
          label={e.next}
          value={next}
          onChangeText={(v) => {
            setNext(v);
            clearPw();
          }}
          secureTextEntry
          autoComplete="new-password"
          placeholder={s.register.passwordPlaceholder}
          error={pwError === 'AUTH_WEAK_PASSWORD' ? s.errors.AUTH_WEAK_PASSWORD : undefined}
        />
        <TextField
          label={e.confirm}
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            clearPw();
          }}
          secureTextEntry
          autoComplete="new-password"
          placeholder={e.confirmPlaceholder}
          error={pwError === 'AUTH_PASSWORD_MISMATCH' ? s.errors.AUTH_PASSWORD_MISMATCH : undefined}
        />
        <Button
          label={e.changePassword}
          variant="secondary"
          disabled={current.length === 0 || next.length === 0 || confirm.length === 0}
          onPress={() => void savePassword()}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  flex: { flex: 1 },
});
