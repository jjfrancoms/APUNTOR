import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Card, Screen, Segmented, Text, TextField, TopBar } from '@/components/ui';
import { useStrings, type ErrorCode } from '@/i18n/es';
import { changePassword, updateProfile, useStore, type Level } from '@/store/store';
import { space } from '@/theme';

/** Editar perfil (nueva, a partir de los comentarios): nombre, correo, nivel y contraseña. */
export default function EditProfile() {
  const s = useStrings();
  const e = s.editProfile;
  const session = useStore((st) => st.session);
  const [fullName, setFullName] = useState(session?.fullName ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [level, setLevel] = useState<Level>(session?.level ?? 'university');
  const [error, setError] = useState<ErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwError, setPwError] = useState<ErrorCode | null>(null);
  const wrongCurrent = pwError === 'AUTH_INVALID';
  const [pwSaved, setPwSaved] = useState(false);
  const levels: Level[] = ['school', 'university', 'other'];

  const save = () => {
    const r = updateProfile({ fullName, email, level });
    setSaved(r.ok);
    setError(r.ok ? null : r.error);
  };
  const savePassword = () => {
    const r = changePassword(current, next);
    setPwSaved(r.ok);
    setPwError(r.ok ? null : r.error);
    if (r.ok) {
      setCurrent('');
      setNext('');
    }
  };

  return (
    <Screen
      header={<TopBar title={e.header} />}
      footer={<Button label={e.save} onPress={save} disabled={fullName.trim().length === 0} />}
    >
      {saved ? <Banner tone="info" icon="check" title={e.saved} /> : null}
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
        <Segmented
          options={levels.map((l) => ({ value: l, label: s.onboarding.levels[l].title }))}
          value={level}
          onChange={(v) => {
            setLevel(v);
            setSaved(false);
          }}
        />
      </View>
      <Text variant="overline" color="textMuted">
        {e.passwordHeader}
      </Text>
      <Card>
        {pwSaved ? <Banner tone="info" icon="check" title={e.passwordChanged} /> : null}
        <TextField
          label={e.current}
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            setPwError(null);
          }}
          secureTextEntry
          autoComplete="current-password"
          error={wrongCurrent ? e.wrongCurrent : undefined}
        />
        <TextField
          label={e.next}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          placeholder={s.register.passwordPlaceholder}
          error={pwError && !wrongCurrent ? s.errors[pwError] : undefined}
        />
        <Button
          label={e.changePassword}
          variant="secondary"
          disabled={current.length === 0 || next.length === 0}
          onPress={savePassword}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: space.sm } });
