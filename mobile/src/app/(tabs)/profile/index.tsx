import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Card, ListRow, Screen, Segmented, Text, TextLink, Toggle } from '@/components/ui';
import { resetDemo, signOut, updateSettings, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { LANGUAGES } from '@/i18n/language';
import { space, useTheme } from '@/theme';

/** Pantalla 7 · Perfil y ajustes */
export default function Profile() {
  const s = useStrings();
  const { c } = useTheme();
  const session = useStore((st) => st.session);
  const st = useStore((x) => x.settings);
  const user = {
    fullName: session?.fullName ?? 'Ana Torres',
    email: session?.email ?? 'ana@correo.com',
    level: s.onboarding.levels[session?.level ?? 'university'].title,
  };
  const [useDocs, external, progress, light, voice] = [
    st.useDocs,
    st.external,
    st.saveProgress,
    st.lightMode,
    st.voice,
  ];
  const setUseDocs = (v: boolean) => updateSettings({ useDocs: v });
  const setExternal = (v: boolean) => updateSettings({ external: v });
  const setProgress = (v: boolean) => updateSettings({ saveProgress: v });
  const setLight = (v: boolean) => updateSettings({ lightMode: v });
  const setVoice = (v: boolean) => updateSettings({ voice: v });
  const toggle = (title: string, value: boolean, set: (v: boolean) => void) => (
    <Toggle value={value} onChange={set} label={title} />
  );
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {s.profile.title}
      </Text>
      <Card style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
          <Text variant="heading" color="primary">
            {user.fullName.charAt(0)}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{user.fullName}</Text>
          <Text variant="caption" color="textMuted">
            {`${user.email} · ${user.level}`}
          </Text>
        </View>
        <TextLink label={s.profile.edit} onPress={() => router.push('/profile/edit')} />
      </Card>
      <Text variant="overline" color="textMuted">
        {s.profile.privacyHeader}
      </Text>
      <Card style={styles.list}>
        <ListRow
          title={s.profile.useDocs.title}
          detail={s.profile.useDocs.detail}
          trailing={toggle(s.profile.useDocs.title, useDocs, setUseDocs)}
        />
        <ListRow
          title={s.profile.external.title}
          detail={s.profile.external.detail}
          trailing={toggle(s.profile.external.title, external, setExternal)}
        />
        <ListRow
          title={s.profile.progress.title}
          divider={false}
          trailing={toggle(s.profile.progress.title, progress, setProgress)}
        />
      </Card>
      <Text variant="overline" color="textMuted">
        {s.profile.appearance.header}
      </Text>
      <Card>
        <Segmented
          options={[
            { value: 'system', label: s.profile.appearance.system },
            { value: 'light', label: s.profile.appearance.light },
            { value: 'dark', label: s.profile.appearance.dark },
          ]}
          value={st.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
        <Text variant="caption" color="textMuted">
          {s.profile.appearance.detail}
        </Text>
      </Card>
      <Text variant="overline" color="textMuted">
        {s.profile.language.header}
      </Text>
      <Card>
        <Segmented
          options={LANGUAGES}
          value={st.language}
          onChange={(language) => updateSettings({ language })}
        />
        <Text variant="caption" color="textMuted">
          {s.profile.language.detail}
        </Text>
      </Card>
      <Text variant="overline" color="textMuted">
        {s.profile.mascotHeader}
      </Text>
      <Card style={styles.list}>
        <ListRow
          title={s.profile.lightMode.title}
          detail={s.profile.lightMode.detail}
          trailing={toggle(s.profile.lightMode.title, light, setLight)}
        />
        <ListRow
          title={s.profile.voice.title}
          divider={false}
          trailing={toggle(s.profile.voice.title, voice, setVoice)}
        />
      </Card>
      <Card style={styles.list}>
        <ListRow
          icon="bell"
          title={s.profile.notifications}
          onPress={() => router.push('/profile/notifications')}
        />
        <ListRow
          icon="credit-card"
          title={s.profile.subscription}
          onPress={() => router.push('/profile/subscription')}
        />
        <ListRow
          icon="help-circle"
          title={s.profile.help}
          onPress={() => router.push('/profile/help')}
        />
        <ListRow
          icon="download"
          title={s.profile.data}
          divider={false}
          onPress={() => router.push('/profile/delete-account')}
        />
      </Card>
      {/* Fuera del diseño: utilidades para probar con datos de ejemplo. */}
      <View style={styles.demo}>
        <TextLink
          label={s.demo.signOut}
          color="danger"
          onPress={() => {
            signOut();
            router.replace('/login');
          }}
        />
        <TextLink
          label={s.demo.reset}
          color="textMuted"
          onPress={() => {
            resetDemo();
            router.replace('/login');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  list: { padding: 0, gap: 0 },
  demo: { alignItems: 'center', gap: space.sm },
});
