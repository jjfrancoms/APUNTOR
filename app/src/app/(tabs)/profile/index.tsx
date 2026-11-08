import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner, Card, ListRow, Screen, Segmented, Text, TextLink, Toggle } from '@/components/ui';
import { useDataDownload } from '@/lib/use-data-download';
import { signOut, updateSettings, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { LANGUAGES } from '@/i18n/language';
import { PREVIEW } from '@/lib/config';
import { space, useTheme } from '@/theme';

/** Pantalla 7 · Perfil y ajustes */
export default function Profile() {
  const s = useStrings();
  const { c } = useTheme();
  const session = useStore((st) => st.session);
  const st = useStore((x) => x.settings);
  // Solo para cuentas que el servidor reconoce como administradoras (nunca se guarda).
  const isAdmin = useStore((x) => x.isAdmin);
  const download = useDataDownload();
  const user = {
    fullName: session?.fullName ?? '',
    email: session?.email ?? '',
    level: s.onboarding.levels[session?.level ?? 'university'].title,
  };
  const [useDocs, external] = [st.useDocs, st.external];
  const setUseDocs = (v: boolean) => updateSettings({ useDocs: v });
  const setExternal = (v: boolean) => updateSettings({ external: v });
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
      <Text variant="smallStrong" accessibilityRole="header">
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
          divider={false}
          trailing={toggle(s.profile.external.title, external, setExternal)}
        />
      </Card>
      <Text variant="smallStrong" accessibilityRole="header">
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
      <Text variant="smallStrong" accessibilityRole="header">
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
      <Card style={styles.list}>
        <ListRow
          icon="bell"
          title={s.profile.notifications}
          onPress={() => router.push('/profile/notifications')}
        />
        {/* Sin pagos todavía: la suscripción (32) solo existe en la vista previa. */}
        {PREVIEW ? (
          <ListRow
            icon="credit-card"
            title={s.profile.subscription}
            onPress={() => router.push('/profile/subscription')}
          />
        ) : null}
        <ListRow
          icon="help-circle"
          title={s.profile.help}
          onPress={() => router.push('/profile/help')}
        />
        <ListRow
          icon="download"
          title={download.busy ? s.dataExport.preparing : s.dataExport.title}
          onPress={() => void download.run()}
        />
        <ListRow
          icon="trash-2"
          title={s.profile.data}
          divider={false}
          onPress={() => router.push('/profile/delete-account')}
        />
      </Card>
      {download.done ? <Banner tone="info" icon="check" title={s.dataExport.done} /> : null}
      {download.error ? <Banner tone="danger" title={download.error} /> : null}
      {isAdmin ? (
        <Card style={styles.list}>
          <ListRow
            icon="shield"
            title={s.admin.entry}
            detail={s.admin.entryDetail}
            divider={false}
            onPress={() => router.push('/admin')}
          />
        </Card>
      ) : null}
      <View style={styles.demo}>
        <TextLink
          label={s.demo.signOut}
          color="danger"
          onPress={() => {
            void signOut().finally(() => router.replace('/login'));
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
