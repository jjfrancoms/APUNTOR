import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import {
  Banner,
  Button,
  Chip,
  EmptyState,
  FilterChips,
  Screen,
  Sheet,
  Text,
  TextField,
  TopBar,
} from '@/components/ui';
import { WaitlistPanel } from '@/components/admin/WaitlistPanel';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import type { ApiAdminUser } from '@/lib/api';
import { formatBytes, formatCount, formatDate, labelFor } from '@/lib/format';
import {
  adminDeleteUser,
  deleteConfirmationMatches,
  deleteConfirmationText,
  isOwnAccount,
  loadAdminUsers,
  useStore,
  withoutUser,
  type AdminError,
} from '@/store/store';
import { space } from '@/theme';

type UserColumn =
  | 'email'
  | 'createdAt'
  | 'lastSignIn'
  | 'provider'
  | 'documents'
  | 'storage'
  | 'questions'
  | 'consent'
  | 'actions';

/**
 * Pantalla 60 · Panel de administración · Usuarios. Lista paginada con metadatos y consumo de
 * cada cuenta; "Borrar cuenta" pide escribir el correo y nunca aplica a la cuenta propia.
 * La sección "Lista de espera" muestra los correos de la pantalla 44 y permite borrarlos.
 * Estados con `?demo=loading|empty|error|offline`.
 */
export default function AdminUsers() {
  const s = useStrings();
  const a = s.admin;
  const u = a.users;
  const language = useLanguage();
  const desktop = useDesktop();
  const demo = toDemo(useLocalSearchParams<{ demo?: string }>().demo);
  const { list, status, error, loadingMore, moreError, reload, loadMore, setList } = useAdminList(
    loadAdminUsers,
    demo,
  );
  const session = useStore((st) => st.session);
  const [target, setTarget] = useState<ApiAdminUser | null>(null);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [view, setView] = useState<'accounts' | 'waitlist'>('accounts');

  const own = (user: ApiAdminUser) => (session ? isOwnAccount(user) : false);
  const provider = (p: string) => labelFor(u.providers, p);
  const consent = (v: string | null) => v ?? u.noConsent;
  const email = (user: ApiAdminUser) => user.email ?? u.noEmail;
  const lastSignIn = (v: string | null) => (v ? formatDate(v, language) : u.never);

  const deleteButton = (user: ApiAdminUser) =>
    own(user) ? (
      <Chip label={u.ownAccount} icon="user" />
    ) : (
      <Button
        label={u.delete}
        icon="trash-2"
        variant="dangerOutline"
        compact
        onPress={() => {
          setDeleted(null);
          setTarget(user);
        }}
      />
    );

  const columns: readonly Column<UserColumn>[] = [
    { key: 'email', label: u.columns.email, flex: 3, min: 200 },
    { key: 'createdAt', label: u.columns.createdAt, flex: 1.2, min: 96 },
    { key: 'lastSignIn', label: u.columns.lastSignIn, flex: 1.2, min: 110 },
    { key: 'provider', label: u.columns.provider, flex: 1, min: 90 },
    { key: 'documents', label: u.columns.documents, flex: 1, min: 96, align: 'right' },
    { key: 'storage', label: u.columns.storage, flex: 1, min: 84, align: 'right' },
    { key: 'questions', label: u.columns.questions, flex: 1, min: 110, align: 'right' },
    { key: 'consent', label: u.columns.consent, flex: 1.3, min: 120 },
    { key: 'actions', label: u.columns.actions, flex: 1.6, min: 170 },
  ];

  const cell = (user: ApiAdminUser, key: UserColumn) => {
    switch (key) {
      case 'email':
        return <CellText strong>{email(user)}</CellText>;
      case 'createdAt':
        return <CellText>{formatDate(user.createdAt, language)}</CellText>;
      case 'lastSignIn':
        return <CellText muted={!user.lastSignInAt}>{lastSignIn(user.lastSignInAt)}</CellText>;
      case 'provider':
        return <CellText>{provider(user.provider)}</CellText>;
      case 'documents':
        return <CellText>{formatCount(user.documents, language)}</CellText>;
      case 'storage':
        return <CellText>{formatBytes(user.storageBytes, language)}</CellText>;
      case 'questions':
        return <CellText>{formatCount(user.questionsToday, language)}</CellText>;
      case 'consent':
        return user.consentVersion ? (
          <CellText>{user.consentVersion}</CellText>
        ) : (
          <Chip label={u.noConsent} tone="warning" />
        );
      case 'actions':
        return deleteButton(user);
    }
  };

  let body;
  if (status === 'loading') body = <AdminSkeleton />;
  else if (status === 'error' && error) {
    body = <AdminErrorState error={error} onRetry={() => void reload()} />;
  } else if (list && list.items.length === 0) {
    body = <EmptyState title={u.emptyTitle} body={u.emptyBody} />;
  } else if (list) {
    body = (
      <>
        {desktop ? (
          <AdminTable columns={columns} rows={list.items} cell={cell} label={a.sections.users} />
        ) : (
          list.items.map((user) => (
            <DataCard
              key={user.id}
              title={email(user)}
              fields={[
                { label: u.columns.createdAt, value: formatDate(user.createdAt, language) },
                { label: u.columns.lastSignIn, value: lastSignIn(user.lastSignInAt) },
                { label: u.columns.provider, value: provider(user.provider) },
                { label: u.columns.documents, value: formatCount(user.documents, language) },
                { label: u.columns.storage, value: formatBytes(user.storageBytes, language) },
                { label: u.columns.questions, value: formatCount(user.questionsToday, language) },
                { label: u.columns.consent, value: consent(user.consentVersion) },
              ]}
            >
              <View style={styles.start}>{deleteButton(user)}</View>
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
    <Screen wide header={<TopBar title={a.title} onBack={() => router.replace('/admin')} />}>
      <AdminHeader
        section="users"
        right={
          view === 'accounts' ? (
            <Button
              label={a.refresh}
              icon="refresh-cw"
              variant="secondary"
              compact
              onPress={() => void reload()}
            />
          ) : undefined
        }
      />
      <FilterChips
        wrap
        options={[
          { value: 'accounts' as const, label: a.waitlist.accounts },
          { value: 'waitlist' as const, label: a.waitlist.list },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'waitlist' ? (
        <WaitlistPanel demo={demo} />
      ) : (
        <>
          {deleted ? <Banner tone="info" icon="check" title={u.deleted(deleted)} /> : null}
          {body}
          <DeleteUserSheet
            user={target}
            onClose={() => setTarget(null)}
            onDeleted={(user) => {
              setTarget(null);
              setDeleted(deleteConfirmationText(user));
              setList((current) => (current ? withoutUser(current, user.id) : current));
            }}
          />
        </>
      )}
    </Screen>
  );
}

/** Confirmación escrita: hay que escribir el correo del usuario. Es irreversible. */
function DeleteUserSheet({
  user,
  onClose,
  onDeleted,
}: {
  user: ApiAdminUser | null;
  onClose: () => void;
  onDeleted: (user: ApiAdminUser) => void;
}) {
  const s = useStrings();
  const u = s.admin.users;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AdminError | null>(null);
  const close = () => {
    if (busy) return;
    setTyped('');
    setError(null);
    onClose();
  };
  if (!user) return null;
  // Se escribe el correo o, si la cuenta no tiene, su id.
  const expected = deleteConfirmationText(user);
  const ok = deleteConfirmationMatches(user, typed);
  const wrong = typed.trim().length > 0 && !ok;
  return (
    <Sheet visible onClose={close} title={u.deleteTitle}>
      <Banner
        tone="danger"
        icon="alert-triangle"
        title={u.deleteWarning}
        body={u.deleteBody(expected)}
      />
      {error ? <Banner tone="danger" title={s.admin.errors[error]} /> : null}
      <TextField
        label={u.confirmLabel(expected)}
        placeholder={expected}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        error={wrong ? u.confirmError : undefined}
      />
      <Button
        label={busy ? u.deleting : u.confirm}
        variant="danger"
        loading={busy}
        disabled={!ok}
        onPress={() => {
          setBusy(true);
          setError(null);
          void adminDeleteUser(user, typed).then((r) => {
            setBusy(false);
            if (r.ok) {
              setTyped('');
              onDeleted(user);
            } else setError(r.error);
          });
        }}
      />
      <Button label={s.common.cancel} variant="secondary" onPress={close} />
      <Text variant="caption" color="textMuted">
        {s.admin.privacyNote}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  start: { alignItems: 'flex-start', marginTop: space.xs },
});
