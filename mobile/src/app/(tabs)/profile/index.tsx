import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ListRow, Screen, Text, TextLink, Toggle } from '@/components/ui';
import { user } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { space, useTheme } from '@/theme';

/** Pantalla 7 · Perfil y ajustes */
export default function Profile() {
  const s = useStrings();
  const { c } = useTheme();
  const [useDocs, setUseDocs] = useState(true);
  const [external, setExternal] = useState(true);
  const [progress, setProgress] = useState(true);
  const [light, setLight] = useState(false);
  const [voice, setVoice] = useState(false);
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
        <TextLink label={s.profile.edit} />
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
          onPress={() => router.push('/notifications-permission')}
        />
        <ListRow icon="credit-card" title={s.profile.subscription} onPress={() => undefined} />
        <ListRow
          icon="help-circle"
          title={s.profile.help}
          onPress={() => router.push('/profile/help')}
        />
        <ListRow icon="download" title={s.profile.data} divider={false} onPress={() => undefined} />
      </Card>
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
});
