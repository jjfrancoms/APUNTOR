import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Mascot,
  Screen,
  Text,
  TextLink,
} from '@/components/ui';
import { sharedSummary } from '@/data/mock';
import { reportContent, useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { space, useTheme } from '@/theme';

/** Pantalla 37 · Resumen compartido (web, solo lectura). `expired` muestra el enlace caducado (48). */
export default function PublicSummary() {
  const s = useStrings();
  const { c } = useTheme();
  const p = s.publicSummary;
  const { token } = useLocalSearchParams<{ token: string }>();
  const share = useStore((st) => st.shares.find((sh) => sh.token === token));
  const owner = useStore((st) => st.session?.name ?? 'Ana');
  const reported = useStore((st) => st.notices.reported.includes(token));
  // 'Xk3m9' es el enlace de ejemplo del diseño; los demás deben existir y estar activos.
  const available = token === 'Xk3m9' || share?.active === true;
  if (!available) {
    return (
      <Screen>
        <EmptyState
          mood="worried"
          title={s.empty.linkTitle}
          body={s.empty.linkBody}
          primary={{ label: p.ctaButton, onPress: () => router.push('/register') }}
        />
      </Screen>
    );
  }
  return (
    <Screen
      footer={
        <View style={styles.center}>
          <Icon name="flag" size={12} color="textMuted" />
          <TextLink
            label={reported ? s.sheets.reportDone : p.report}
            color="textMuted"
            variant="caption"
            onPress={() => reportContent(token)}
          />
        </View>
      }
    >
      <View style={styles.row}>
        <Mascot size={32} />
        <Text variant="smallStrong">{p.brand}</Text>
      </View>
      <View style={styles.row}>
        <Chip label={p.aiBadge} tone="primary" icon="star" />
        <Chip label={p.readOnly} icon="lock" />
      </View>
      <View>
        <Text variant="title" accessibilityRole="header">
          {sharedSummary.title}
        </Text>
        <Text variant="caption" color="textMuted">
          {p.sharedBy(owner, sharedSummary.course)}
        </Text>
      </View>
      <Card>
        {sharedSummary.points.map((pt) => (
          <View key={pt} style={styles.bullet}>
            <View style={[styles.dot, { backgroundColor: c.primary }]} />
            <Text variant="small" style={styles.flex}>
              {pt}
            </Text>
          </View>
        ))}
      </Card>
      <Text variant="caption" color="textMuted">
        {p.disclaimer(sharedSummary.expires)}
      </Text>
      <Card tone="primary" style={styles.cta}>
        <Text variant="bodyStrong">{p.ctaTitle}</Text>
        <Text variant="caption" color="textMuted">
          {p.ctaBody}
        </Text>
        <Button label={p.ctaButton} onPress={() => router.push('/register')} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bullet: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  flex: { flex: 1 },
  cta: { marginTop: 'auto' },
  center: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
});
