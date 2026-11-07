import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AdminErrorState,
  AdminHeader,
  AdminSkeleton,
  AdminTable,
  CellText,
  DataCard,
  LoadMore,
  StatusChip,
  toDemo,
  useAdminList,
  useDesktop,
  type Column,
} from '@/components/admin/AdminKit';
import { Banner, Button, EmptyState, FilterChips, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import type { ApiAdminDocument } from '@/lib/api';
import { formatBytes, formatCount, formatDate } from '@/lib/format';
import {
  canRetryDocument,
  loadAdminDocuments,
  markDocumentRetried,
  retryAdminDocument,
  type AdminDocumentFilter,
} from '@/store/store';
import { space } from '@/theme';

const FILTERS: readonly AdminDocumentFilter[] = [
  'all',
  'failed',
  'pending',
  'processing',
  'completed',
];

function toFilter(value: string | undefined): AdminDocumentFilter {
  return FILTERS.find((f) => f === value) ?? 'all';
}

type DocColumn =
  'title' | 'size' | 'status' | 'pages' | 'topics' | 'createdAt' | 'error' | 'actions';

/**
 * Pantalla 61 · Panel de administración · Documentos. Filtro por estado y lista paginada con
 * metadatos (nunca el contenido); "Reintentar" solo en los que fallaron. `?status=failed` abre
 * el filtro; estados con `?demo=loading|empty|error|offline`.
 */
export default function AdminDocuments() {
  const s = useStrings();
  const a = s.admin;
  const d = a.documents;
  const language = useLanguage();
  const desktop = useDesktop();
  const params = useLocalSearchParams<{ demo?: string; status?: string }>();
  const demo = toDemo(params.demo);
  const [filter, setFilter] = useState<AdminDocumentFilter>(toFilter(params.status));
  const load = useCallback((page: number) => loadAdminDocuments(filter, page), [filter]);
  const { list, status, error, loadingMore, moreError, reload, loadMore, setList } = useAdminList(
    load,
    demo,
  );
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const retry = (doc: ApiAdminDocument) => {
    setRetrying(doc.id);
    setNotice(null);
    void retryAdminDocument(doc).then((r) => {
      setRetrying(null);
      if (r.ok) {
        setList((current) => (current ? markDocumentRetried(current, doc.id) : current));
        setNotice({ ok: true, text: d.retried(name(doc)) });
      } else {
        setNotice({ ok: false, text: a.errors[r.error] });
      }
    });
  };

  const name = (doc: ApiAdminDocument) =>
    doc.title.trim().length > 0 ? doc.title : d.untitled(doc.id);
  const pages = (v: number | null) => (v === null ? a.none : formatCount(v, language));
  const reason = (doc: ApiAdminDocument) =>
    doc.status === 'failed' ? (doc.errorMessage ?? d.noReason) : a.none;
  const retryButton = (doc: ApiAdminDocument) =>
    canRetryDocument(doc) ? (
      <Button
        label={d.retry}
        icon="rotate-cw"
        variant="soft"
        compact
        loading={retrying === doc.id}
        disabled={retrying !== null && retrying !== doc.id}
        onPress={() => retry(doc)}
      />
    ) : null;

  const columns: readonly Column<DocColumn>[] = [
    { key: 'title', label: d.columns.title, flex: 3, min: 200 },
    { key: 'size', label: d.columns.size, flex: 1, min: 84, align: 'right' },
    { key: 'status', label: d.columns.status, flex: 1.2, min: 120 },
    { key: 'pages', label: d.columns.pages, flex: 0.8, min: 76, align: 'right' },
    { key: 'topics', label: d.columns.topics, flex: 0.8, min: 70, align: 'right' },
    { key: 'createdAt', label: d.columns.createdAt, flex: 1, min: 96 },
    { key: 'error', label: d.columns.error, flex: 2.4, min: 180 },
    { key: 'actions', label: d.columns.actions, flex: 1.2, min: 140 },
  ];

  const cell = (doc: ApiAdminDocument, key: DocColumn) => {
    switch (key) {
      case 'title':
        return <CellText strong>{name(doc)}</CellText>;
      case 'size':
        return <CellText>{formatBytes(doc.sizeBytes, language)}</CellText>;
      case 'status':
        return <StatusChip status={doc.status} />;
      case 'pages':
        return <CellText>{pages(doc.totalPages)}</CellText>;
      case 'topics':
        return <CellText>{formatCount(doc.topicCount, language)}</CellText>;
      case 'createdAt':
        return <CellText>{formatDate(doc.createdAt, language)}</CellText>;
      case 'error':
        return doc.status === 'failed' ? (
          <Text variant="small" color="danger" numberOfLines={3}>
            {reason(doc)}
          </Text>
        ) : (
          <CellText muted>{a.none}</CellText>
        );
      case 'actions':
        return retryButton(doc) ?? <CellText muted>{a.none}</CellText>;
    }
  };

  let body;
  // Al cambiar de filtro, la lista anterior no se muestra mientras llega la nueva.
  if (status === 'loading') body = <AdminSkeleton />;
  else if (status === 'error' && error) {
    body = <AdminErrorState error={error} onRetry={() => void reload()} />;
  } else if (list && list.items.length === 0) {
    body = (
      <EmptyState
        mood={filter === 'failed' ? 'happy' : 'curious'}
        title={d.emptyTitle}
        body={filter === 'failed' ? d.emptyFailedBody : d.emptyBody}
      />
    );
  } else if (list) {
    body = (
      <>
        {desktop ? (
          <AdminTable
            columns={columns}
            rows={list.items}
            cell={cell}
            label={a.sections.documents}
          />
        ) : (
          list.items.map((doc) => (
            <DataCard
              key={doc.id}
              title={name(doc)}
              tone={doc.status === 'failed' ? 'danger' : 'default'}
              badge={<StatusChip status={doc.status} />}
              fields={[
                { label: d.columns.size, value: formatBytes(doc.sizeBytes, language) },
                { label: d.columns.pages, value: pages(doc.totalPages) },
                { label: d.columns.topics, value: formatCount(doc.topicCount, language) },
                { label: d.columns.createdAt, value: formatDate(doc.createdAt, language) },
                ...(doc.status === 'failed'
                  ? [{ label: d.columns.error, value: reason(doc) }]
                  : []),
              ]}
            >
              {canRetryDocument(doc) ? <View style={styles.start}>{retryButton(doc)}</View> : null}
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
        section="documents"
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
      <View style={styles.filters}>
        <Text variant="smallStrong">{d.filterLabel}</Text>
        <FilterChips
          wrap
          options={FILTERS.map((value) => ({ value, label: d.filters[value] }))}
          value={filter}
          onChange={(next) => {
            setNotice(null);
            setFilter(next);
          }}
        />
      </View>
      {notice ? (
        <Banner
          tone={notice.ok ? 'info' : 'danger'}
          icon={notice.ok ? 'check' : undefined}
          title={notice.text}
        />
      ) : null}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm },
  start: { alignItems: 'flex-start', marginTop: space.xs },
});
