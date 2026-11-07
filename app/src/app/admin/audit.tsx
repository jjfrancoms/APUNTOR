import { router, useLocalSearchParams } from 'expo-router';
import {
  AdminErrorState,
  AdminHeader,
  AdminSkeleton,
  AdminTable,
  CellText,
  DataCard,
  LoadMore,
  toDemo,
  useAdminList,
  useDesktop,
  type Column,
} from '@/components/admin/AdminKit';
import { Button, EmptyState, Screen, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import type { ApiAdminAuditEntry } from '@/lib/api';
import { formatDateTime, labelFor } from '@/lib/format';
import { loadAdminAudit } from '@/store/store';

type AuditColumn = 'date' | 'admin' | 'action' | 'target';

/**
 * Pantalla 62 · Panel de administración · Auditoría. Lista paginada de las acciones de los
 * administradores (quién, qué, sobre qué y cuándo). Estados con
 * `?demo=loading|empty|error|offline`.
 */
export default function AdminAudit() {
  const s = useStrings();
  const a = s.admin;
  const col = a.audit.columns;
  const language = useLanguage();
  const desktop = useDesktop();
  const demo = toDemo(useLocalSearchParams<{ demo?: string }>().demo);
  const { list, status, error, loadingMore, moreError, reload, loadMore } = useAdminList(
    loadAdminAudit,
    demo,
  );

  const columns: readonly Column<AuditColumn>[] = [
    { key: 'date', label: col.date, flex: 1.2, min: 150 },
    { key: 'admin', label: col.admin, flex: 2, min: 200 },
    { key: 'action', label: col.action, flex: 1.5, min: 160 },
    { key: 'target', label: col.target, flex: 2.5, min: 220 },
  ];
  const action = (entry: ApiAdminAuditEntry) => labelFor(a.audit.actions, entry.action);
  const cell = (entry: ApiAdminAuditEntry, key: AuditColumn) => {
    switch (key) {
      case 'date':
        return <CellText>{formatDateTime(entry.createdAt, language)}</CellText>;
      case 'admin':
        return <CellText>{entry.adminEmail}</CellText>;
      case 'action':
        return <CellText strong>{action(entry)}</CellText>;
      case 'target':
        return <CellText muted>{entry.target}</CellText>;
    }
  };

  let body;
  if (status === 'loading') body = <AdminSkeleton />;
  else if (status === 'error' && error) {
    body = <AdminErrorState error={error} onRetry={() => void reload()} />;
  } else if (list && list.items.length === 0) {
    body = <EmptyState title={a.audit.emptyTitle} body={a.audit.emptyBody} />;
  } else if (list) {
    body = (
      <>
        {desktop ? (
          <AdminTable columns={columns} rows={list.items} cell={cell} label={a.sections.audit} />
        ) : (
          list.items.map((entry) => (
            <DataCard
              key={entry.id}
              title={action(entry)}
              fields={[
                { label: col.date, value: formatDateTime(entry.createdAt, language) },
                { label: col.admin, value: entry.adminEmail },
                { label: col.target, value: entry.target },
              ]}
            />
          ))
        )}
        <LoadMore
          hasMore={list.hasMore}
          loading={loadingMore}
          error={moreError}
          onPress={() => void loadMore()}
        />
      </>
    );
  } else body = <AdminSkeleton />;

  return (
    <Screen wide header={<TopBar title={a.title} onBack={() => router.replace('/admin')} />}>
      <AdminHeader
        section="audit"
        right={
          <Button
            label={a.refresh}
            icon="refresh-cw"
            variant="secondary"
            compact
            onPress={() => void reload()}
          />
        }
      />
      {body}
    </Screen>
  );
}
