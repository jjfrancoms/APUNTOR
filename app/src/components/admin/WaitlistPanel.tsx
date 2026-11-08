import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AdminErrorState,
  AdminSkeleton,
  AdminTable,
  CellText,
  DataCard,
  LoadMore,
  useAdminList,
  useDesktop,
  type AdminDemo,
  type Column,
} from '@/components/admin/AdminKit';
import { Banner, Button, EmptyState, Sheet } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import type { ApiAdminWaitlistEntry } from '@/lib/api';
import { formatDate, labelFor } from '@/lib/format';
import { adminDeleteWaitlistEntry, loadAdminWaitlist, type AdminError } from '@/store/store';
import { space } from '@/theme';

type WaitlistColumn = 'email' | 'createdAt' | 'source' | 'consent' | 'actions';

/**
 * Sección "Lista de espera" del panel (dentro de la pantalla 60): correos que dejaron en la
 * pantalla 44, con fecha, origen y consentimiento. Permite borrar una inscripción si la
 * persona lo pide. No hay contenido de ningún usuario aquí.
 */
export function WaitlistPanel({ demo }: { demo: AdminDemo }) {
  const s = useStrings();
  const a = s.admin;
  const w = a.waitlist;
  const language = useLanguage();
  const desktop = useDesktop();
  const { list, status, error, loadingMore, moreError, reload, loadMore, setList } = useAdminList(
    loadAdminWaitlist,
    demo,
  );
  const [target, setTarget] = useState<ApiAdminWaitlistEntry | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);

  const source = (entry: ApiAdminWaitlistEntry) => labelFor(w.sources, entry.source);
  const consent = (entry: ApiAdminWaitlistEntry) => (entry.consent ? w.consentYes : w.consentNo);
  const deleteButton = (entry: ApiAdminWaitlistEntry) => (
    <Button
      label={w.delete}
      icon="trash-2"
      variant="dangerOutline"
      compact
      onPress={() => {
        setDeleted(null);
        setTarget(entry);
      }}
    />
  );

  const columns: readonly Column<WaitlistColumn>[] = [
    { key: 'email', label: w.columns.email, flex: 3, min: 220 },
    { key: 'createdAt', label: w.columns.createdAt, flex: 1.2, min: 96 },
    { key: 'source', label: w.columns.source, flex: 1, min: 80 },
    { key: 'consent', label: w.columns.consent, flex: 1.2, min: 120 },
    { key: 'actions', label: w.columns.actions, flex: 1.2, min: 130 },
  ];
  const cell = (entry: ApiAdminWaitlistEntry, key: WaitlistColumn) => {
    switch (key) {
      case 'email':
        return <CellText strong>{entry.email}</CellText>;
      case 'createdAt':
        return <CellText>{formatDate(entry.createdAt, language)}</CellText>;
      case 'source':
        return <CellText>{source(entry)}</CellText>;
      case 'consent':
        return <CellText>{consent(entry)}</CellText>;
      case 'actions':
        return deleteButton(entry);
    }
  };

  let body;
  if (status === 'loading') body = <AdminSkeleton />;
  else if (status === 'error' && error) {
    body = <AdminErrorState error={error} onRetry={() => void reload()} />;
  } else if (list && list.items.length === 0) {
    body = <EmptyState title={w.emptyTitle} body={w.emptyBody} />;
  } else if (list) {
    body = (
      <>
        {desktop ? (
          <AdminTable columns={columns} rows={list.items} cell={cell} label={w.list} />
        ) : (
          list.items.map((entry) => (
            <DataCard
              key={entry.id}
              title={entry.email}
              fields={[
                { label: w.columns.createdAt, value: formatDate(entry.createdAt, language) },
                { label: w.columns.source, value: source(entry) },
                { label: w.columns.consent, value: consent(entry) },
              ]}
            >
              <View style={styles.start}>{deleteButton(entry)}</View>
            </DataCard>
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
    <>
      <View style={styles.start}>
        <Button
          label={a.refresh}
          icon="refresh-cw"
          variant="secondary"
          compact
          onPress={() => void reload()}
        />
      </View>
      {deleted ? <Banner tone="info" icon="check" title={w.deleted(deleted)} /> : null}
      {body}
      <DeleteEntrySheet
        entry={target}
        onClose={() => setTarget(null)}
        onDeleted={(entry) => {
          setTarget(null);
          setDeleted(entry.email);
          setList((current) =>
            current
              ? { ...current, items: current.items.filter((i) => i.id !== entry.id) }
              : current,
          );
        }}
      />
    </>
  );
}

function DeleteEntrySheet({
  entry,
  onClose,
  onDeleted,
}: {
  entry: ApiAdminWaitlistEntry | null;
  onClose: () => void;
  onDeleted: (entry: ApiAdminWaitlistEntry) => void;
}) {
  const s = useStrings();
  const w = s.admin.waitlist;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AdminError | null>(null);
  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };
  if (!entry) return null;
  return (
    <Sheet visible onClose={close} title={w.deleteTitle}>
      <Banner tone="danger" icon="alert-triangle" title={w.deleteBody(entry.email)} />
      {error ? <Banner tone="danger" title={s.admin.errors[error]} /> : null}
      <Button
        label={busy ? w.deleting : w.confirm}
        variant="danger"
        loading={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          void adminDeleteWaitlistEntry(entry.id).then((r) => {
            setBusy(false);
            if (r.ok) onDeleted(entry);
            else setError(r.error);
          });
        }}
      />
      <Button label={s.common.cancel} variant="secondary" onPress={close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  start: { flexDirection: 'row', justifyContent: 'flex-start', gap: space.sm },
});
