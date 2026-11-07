import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AdminErrorState,
  AdminHeader,
  AdminSkeleton,
  toDemo,
  useDesktop,
} from '@/components/admin/AdminKit';
import { Banner, Button, Card, EmptyState, ListRow, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import type { ApiAdminStats } from '@/lib/api';
import { formatBytes, formatCount } from '@/lib/format';
import { loadAdminStats, type AdminError } from '@/store/store';
import { space } from '@/theme';

const STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;

/**
 * Pantalla 59 · Panel de administración · Resumen. Conteos generales (nunca contenido) y
 * accesos a Usuarios, Documentos y Auditoría. Estados con `?demo=loading|empty|error|offline`.
 */
export default function AdminOverview() {
  const s = useStrings();
  const a = s.admin;
  const language = useLanguage();
  const desktop = useDesktop();
  const demo = toDemo(useLocalSearchParams<{ demo?: string }>().demo);
  const [stats, setStats] = useState<ApiAdminStats | null>(null);
  const [error, setError] = useState<AdminError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await loadAdminStats();
    setLoading(false);
    if (r.ok) setStats(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    if (!demo) void load();
  }, [load, demo]);

  const header = <TopBar title={a.title} onBack={() => router.replace('/profile')} />;
  const top = (
    <AdminHeader
      section="overview"
      right={
        <Button
          label={a.refresh}
          icon="refresh-cw"
          variant="secondary"
          compact
          onPress={() => void load()}
        />
      }
    />
  );

  const shownError: AdminError | null =
    demo === 'offline' ? 'offline' : demo === 'error' ? 'failed' : demo ? null : error;
  const empty: ApiAdminStats = {
    users: 0,
    documents: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
    storageBytes: 0,
    questionsToday: 0,
    consents: { currentVersionUsers: 0 },
  };
  const data = demo === 'empty' ? empty : stats;

  let body;
  if (demo === 'loading' || (!demo && loading && !stats)) {
    body = <AdminSkeleton rows={5} />;
  } else if (shownError) {
    body = <AdminErrorState error={shownError} onRetry={() => void load()} />;
  } else if (!data) {
    body = <AdminSkeleton rows={5} />;
  } else if (data.users === 0 && data.documents.total === 0) {
    body = <EmptyState title={a.users.emptyTitle} body={a.users.emptyBody} />;
  } else {
    const n = (v: number) => formatCount(v, language);
    const failed = data.documents.failed;
    body = (
      <>
        {failed > 0 ? (
          <Banner tone="danger" title={a.stats.failedAlert(failed)}>
            <View style={styles.start}>
              <Button
                label={a.stats.seeFailed}
                variant="dangerOutline"
                compact
                onPress={() => router.push('/admin/documents?status=failed')}
              />
            </View>
          </Banner>
        ) : null}
        <View style={styles.grid}>
          <Stat label={a.stats.users} value={n(data.users)} desktop={desktop} />
          <Stat label={a.stats.documents} value={n(data.documents.total)} desktop={desktop} />
          <Stat
            label={a.stats.storage}
            value={formatBytes(data.storageBytes, language)}
            desktop={desktop}
          />
          <Stat label={a.stats.questionsToday} value={n(data.questionsToday)} desktop={desktop} />
          <Stat
            label={a.stats.consents}
            value={n(data.consents.currentVersionUsers)}
            detail={a.stats.consentsDetail(data.consents.currentVersionUsers, data.users)}
            desktop={desktop}
          />
        </View>
        <Text variant="heading">{a.stats.byStatus}</Text>
        <View style={styles.grid}>
          {STATUSES.map((status) => (
            <Stat
              key={status}
              label={a.status[status]}
              value={n(data.documents[status])}
              desktop={desktop}
              danger={status === 'failed' && data.documents.failed > 0}
              onPress={() => router.push(`/admin/documents?status=${status}`)}
            />
          ))}
        </View>
      </>
    );
  }

  return (
    <Screen wide header={header}>
      {top}
      {body}
      <Card style={styles.list}>
        <ListRow
          icon="users"
          title={a.sections.users}
          detail={a.sectionDetail.users}
          onPress={() => router.push('/admin/users')}
        />
        <ListRow
          icon="file-text"
          title={a.sections.documents}
          detail={a.sectionDetail.documents}
          onPress={() => router.push('/admin/documents')}
        />
        <ListRow
          icon="clipboard"
          title={a.sections.audit}
          detail={a.sectionDetail.audit}
          divider={false}
          onPress={() => router.push('/admin/audit')}
        />
      </Card>
    </Screen>
  );
}

/** Tarjeta con un número grande. Los fallidos se resaltan en rojo (con texto, no solo color). */
function Stat({
  label,
  value,
  detail,
  desktop,
  danger,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  desktop: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  const s = useStrings();
  const content = (
    <Card tone={danger ? 'danger' : 'default'} style={styles.statCard}>
      <Text variant="small" color={danger ? 'danger' : 'textMuted'}>
        {label}
      </Text>
      <Text variant="title" color={danger ? 'danger' : 'text'}>
        {value}
      </Text>
      {detail ? (
        <Text variant="caption" color="textMuted">
          {detail}
        </Text>
      ) : null}
      {onPress ? (
        <View style={styles.start}>
          <Button
            label={`${s.admin.stats.goTo} ${label}`}
            variant={danger ? 'dangerOutline' : 'soft'}
            compact
            onPress={onPress}
          />
        </View>
      ) : null}
    </Card>
  );
  return (
    <View style={[styles.stat, desktop ? styles.statDesktop : styles.statMobile]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  stat: { flexGrow: 1 },
  statDesktop: { flexBasis: 200 },
  statMobile: { flexBasis: '45%' },
  statCard: { flex: 1, gap: space.xs },
  start: { alignItems: 'flex-start' },
  list: { padding: 0, gap: 0 },
});
