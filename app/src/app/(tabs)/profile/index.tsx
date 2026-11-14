import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Banner,
  Button,
  Card,
  ListRow,
  Screen,
  Segmented,
  Text,
  TextLink,
  Toggle,
} from '@/components/ui';
import { revealThemeChange } from '@/lib/theme-transition';
import { useDataDownload } from '@/lib/use-data-download';
import { signOut, updateSettings, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { LANGUAGES } from '@/i18n/language';
import { PREVIEW } from '@/lib/config';
import { space, useTheme, useWide } from '@/theme';

/** Pantalla 7 · Perfil y ajustes */
export default function Profile() {
  const s = useStrings();
  const { c } = useTheme();
  const wide = useWide();
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
  const rule = { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth };

  // Identidad: foto o iniciales, nombre y correo; "Editar" como acción secundaria.
  const identity = (
    <View style={styles.identity}>
      <Avatar name={user.fullName || user.email} size="lg" />
      <View style={styles.flex}>
        <Text variant="heading">{user.fullName}</Text>
        <Text variant="small" color="textMuted">
          {`${user.email} · ${user.level}`}
        </Text>
      </View>
      <Button
        label={s.profile.edit}
        variant="secondary"
        size="sm"
        onPress={() => router.push('/profile/edit')}
      />
    </View>
  );

  // Columna de la cuenta: privacidad (interruptores) y datos propios.
  const account = (
    <>
      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {s.profile.privacyHeader}
        </Text>
        <View>
          <Toggle
            value={useDocs}
            onChange={setUseDocs}
            label={s.profile.useDocs.title}
            title={s.profile.useDocs.title}
            description={s.profile.useDocs.detail}
          />
          <View style={[styles.second, rule]}>
            <Toggle
              value={external}
              onChange={setExternal}
              label={s.profile.external.title}
              title={s.profile.external.title}
              description={s.profile.external.detail}
            />
          </View>
        </View>
      </View>
      <Card style={styles.list}>
        {/* Sin pagos todavía: la suscripción (32) solo existe en la vista previa. */}
        {PREVIEW ? (
          <ListRow
            icon="credit-card"
            title={s.profile.subscription}
            onPress={() => router.push('/profile/subscription')}
          />
        ) : null}
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
    </>
  );

  // Columna de preferencias: apariencia, idioma, notificaciones y ayuda.
  const preferences = (
    <>
      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {s.profile.appearance.header}
        </Text>
        <Segmented
          options={[
            { value: 'system', label: s.profile.appearance.system },
            { value: 'light', label: s.profile.appearance.light },
            { value: 'dark', label: s.profile.appearance.dark },
          ]}
          value={st.theme}
          onChange={(theme) => revealThemeChange(() => updateSettings({ theme }))}
        />
        <Text variant="caption" color="textMuted">
          {s.profile.appearance.detail}
        </Text>
      </View>
      <View style={styles.section}>
        <Text variant="heading" accessibilityRole="header">
          {s.profile.language.header}
        </Text>
        <Segmented
          options={LANGUAGES}
          value={st.language}
          onChange={(language) => updateSettings({ language })}
        />
        <Text variant="caption" color="textMuted">
          {s.profile.language.detail}
        </Text>
      </View>
      <Card style={styles.list}>
        <ListRow
          icon="bell"
          title={s.profile.notifications}
          onPress={() => router.push('/profile/notifications')}
        />
        <ListRow
          icon="help-circle"
          title={s.profile.help}
          divider={isAdmin}
          onPress={() => router.push('/profile/help')}
        />
        {isAdmin ? (
          <ListRow
            icon="shield"
            title={s.admin.entry}
            detail={s.admin.entryDetail}
            divider={false}
            onPress={() => router.push('/admin')}
          />
        ) : null}
      </Card>
      <View style={styles.start}>
        <TextLink
          label={s.demo.signOut}
          color="danger"
          onPress={() => {
            void signOut().finally(() => router.replace('/login'));
          }}
        />
      </View>
    </>
  );

  return (
    <Screen wide>
      <Text variant="display" accessibilityRole="header">
        {s.profile.title}
      </Text>
      {identity}
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.col}>{account}</View>
          <View style={styles.col}>{preferences}</View>
        </View>
      ) : (
        <>
          {account}
          {preferences}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  section: { gap: space.sm },
  second: { marginTop: space.md, paddingTop: space.md },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxxl },
  col: { flex: 1, minWidth: 0, gap: space.xl },
  list: { padding: 0, gap: 0 },
  start: { alignItems: 'flex-start' },
});
