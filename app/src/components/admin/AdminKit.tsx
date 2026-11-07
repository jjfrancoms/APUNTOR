/**
 * Piezas compartidas del panel de administración (pantallas 59–62): carga paginada con sus
 * estados, tabla para escritorio, tarjetas de datos para celular y navegación entre secciones.
 * El panel solo muestra metadatos, conteos y estados: nunca contenido de documentos o preguntas.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Banner, Button, Card, Chip, EmptyState, FilterChips, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import type { ApiDocumentStatus } from '@/lib/api';
import { mergeAdminPage, type AdminError, type AdminPage, type AdminResult } from '@/store/store';
import { layout, radius, space, useTheme } from '@/theme';

/** Escritorio (≥ 1024 px): tablas; en celular y tablet, tarjetas. */
export function useDesktop(): boolean {
  return useWindowDimensions().width >= layout.breakpoints.desktop;
}

/** Estados de demostración (`?demo=`), como en el resto de la app. */
export type AdminDemo = 'loading' | 'empty' | 'error' | 'offline' | undefined;

export function toDemo(value: string | string[] | undefined): AdminDemo {
  return value === 'loading' || value === 'empty' || value === 'error' || value === 'offline'
    ? value
    : undefined;
}

export type LoadStatus = 'loading' | 'ready' | 'error';

/** Lista paginada del panel: primera carga, "Cargar más", recarga y errores de cada paso. */
export function useAdminList<T extends { id: string }>(
  load: (page: number) => Promise<AdminResult<AdminPage<T>>>,
  demo: AdminDemo,
) {
  const [list, setList] = useState<AdminPage<T> | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<AdminError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<AdminError | null>(null);
  // Solo vale la respuesta del último pedido (al cambiar de filtro, la anterior se descarta).
  const request = useRef(0);

  const reload = useCallback(async () => {
    const id = ++request.current;
    setStatus('loading');
    setError(null);
    setMoreError(null);
    const r = await load(1);
    if (id !== request.current) return;
    if (r.ok) {
      setList(r.data);
      setStatus('ready');
    } else {
      setError(r.error);
      setStatus('error');
    }
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!list?.hasMore || loadingMore) return;
    const id = request.current;
    setLoadingMore(true);
    setMoreError(null);
    const r = await load(list.page + 1);
    // Siempre se libera el botón: si hubo una recarga entretanto, solo se descarta la página.
    setLoadingMore(false);
    if (id !== request.current) return;
    if (r.ok) {
      setList((current) => mergeAdminPage(current, r.data));
    } else {
      setMoreError(r.error);
    }
  }, [list, loadingMore, load]);

  useEffect(() => {
    if (demo) return;
    void reload();
  }, [reload, demo]);

  const actions = { loadingMore, moreError, reload, loadMore, setList };
  if (demo === 'loading')
    return { ...actions, list: null, status: 'loading' as LoadStatus, error: null };
  if (demo === 'empty') {
    const empty: AdminPage<T> = { items: [], page: 1, hasMore: false };
    return { ...actions, list: empty, status: 'ready' as LoadStatus, error: null };
  }
  if (demo === 'error' || demo === 'offline') {
    const demoError: AdminError = demo === 'offline' ? 'offline' : 'failed';
    return { ...actions, list: null, status: 'error' as LoadStatus, error: demoError };
  }
  return { ...actions, list, status, error };
}

/** Esqueleto con la forma de una lista mientras carga. */
export function AdminSkeleton({ rows = 6 }: { rows?: number }) {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <View
      accessibilityLabel={s.admin.loading}
      accessibilityRole="progressbar"
      style={styles.skeleton}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={[styles.skeletonRow, { backgroundColor: c.surfaceAlt, height: i === 0 ? 40 : 56 }]}
        />
      ))}
    </View>
  );
}

/** Error de carga a pantalla completa: sin conexión o del servidor, siempre con "Reintentar". */
export function AdminErrorState({ error, onRetry }: { error: AdminError; onRetry: () => void }) {
  const s = useStrings();
  const offline = error === 'offline';
  return (
    <EmptyState
      mood={offline ? 'sleepy' : 'worried'}
      title={offline ? s.admin.offlineTitle : s.admin.errorTitle}
      body={s.admin.errors[error]}
      primary={
        error === 'forbidden'
          ? { label: s.empty.backHome, onPress: () => router.replace('/home') }
          : { label: s.admin.retry, onPress: onRetry }
      }
    />
  );
}

/** Pie de una lista paginada: botón "Cargar más" y el error de la última página, si hubo. */
export function LoadMore({
  hasMore,
  loading,
  error,
  onPress,
}: {
  hasMore: boolean;
  loading: boolean;
  error: AdminError | null;
  onPress: () => void;
}) {
  const s = useStrings();
  return (
    <View style={styles.more}>
      {error ? <Banner tone="danger" title={s.admin.errors[error]} /> : null}
      {hasMore ? (
        <Button
          label={error ? s.admin.retry : s.admin.loadMore}
          variant="secondary"
          compact
          loading={loading}
          onPress={onPress}
        />
      ) : null}
    </View>
  );
}

/** Pestañas del panel. En escritorio quedan arriba de cada sección. */
export type AdminSection = 'overview' | 'users' | 'documents' | 'audit';

const SECTION_ROUTES = {
  overview: '/admin',
  users: '/admin/users',
  documents: '/admin/documents',
  audit: '/admin/audit',
} as const;

export function AdminNav({ current }: { current: AdminSection }) {
  const s = useStrings();
  const options = (Object.keys(SECTION_ROUTES) as AdminSection[]).map((value) => ({
    value,
    label: s.admin.sections[value],
  }));
  return (
    <FilterChips
      wrap
      options={options}
      value={current}
      onChange={(next) => {
        if (next !== current) router.replace(SECTION_ROUTES[next]);
      }}
    />
  );
}

/** Encabezado de cada sección: título, aviso de privacidad y navegación entre secciones. */
export function AdminHeader({ section, right }: { section: AdminSection; right?: ReactNode }) {
  const s = useStrings();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text variant="caption" color="textMuted">
            {s.admin.title}
          </Text>
          <Text variant="display" accessibilityRole="header">
            {s.admin.sections[section]}
          </Text>
        </View>
        {right}
      </View>
      <AdminNav current={section} />
      <Text variant="caption" color="textMuted">
        {s.admin.privacyNote}
      </Text>
    </View>
  );
}

const STATUS_TONE = {
  pending: 'neutral',
  processing: 'warning',
  completed: 'primary',
  failed: 'danger',
} as const;

export function StatusChip({ status }: { status: ApiDocumentStatus }) {
  const s = useStrings();
  return (
    <Chip
      label={s.admin.status[status]}
      tone={STATUS_TONE[status]}
      icon={status === 'failed' ? 'alert-triangle' : undefined}
    />
  );
}

/** Columna de la tabla: `flex` reparte el ancho; `min` evita que se aplaste. */
export interface Column<K extends string> {
  key: K;
  label: string;
  flex: number;
  min: number;
  align?: 'left' | 'right';
}

/**
 * Tabla legible para escritorio. Si la ventana es más angosta que la suma de los mínimos, la
 * tabla se desplaza a lo ancho en lugar de aplastar las columnas.
 */
export function AdminTable<T extends { id: string }, K extends string>({
  columns,
  rows,
  cell,
  label,
}: {
  columns: readonly Column<K>[];
  rows: readonly T[];
  cell: (row: T, key: K) => ReactNode;
  label: string;
}) {
  const { c } = useTheme();
  const minWidth = columns.reduce((sum, col) => sum + col.min, 0);
  const box = (col: Column<K>) => ({
    flex: col.flex,
    minWidth: col.min,
    alignItems: col.align === 'right' ? ('flex-end' as const) : ('flex-start' as const),
  });
  return (
    <ScrollView horizontal contentContainerStyle={styles.tableScroll}>
      <View
        accessibilityLabel={label}
        style={[styles.table, { minWidth, borderColor: c.border, backgroundColor: c.surface }]}
      >
        <View style={[styles.tr, { backgroundColor: c.surfaceAlt, borderBottomColor: c.border }]}>
          {columns.map((col) => (
            <View key={col.key} style={[styles.td, box(col)]}>
              <Text variant="smallStrong" color="textMuted" numberOfLines={1}>
                {col.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row, i) => (
          <View
            key={row.id}
            style={[
              styles.tr,
              { borderBottomColor: c.border },
              i === rows.length - 1 && styles.last,
            ]}
          >
            {columns.map((col) => (
              <View key={col.key} style={[styles.td, box(col)]}>
                {cell(row, col.key)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/** Texto de una celda (una línea, con el valor completo para lectores de pantalla). */
export function CellText({
  children,
  strong,
  muted,
}: {
  children: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <Text
      variant={strong ? 'smallStrong' : 'small'}
      color={muted ? 'textMuted' : 'text'}
      numberOfLines={2}
    >
      {children}
    </Text>
  );
}

/** Tarjeta de celular: título, pares dato-valor y acciones. */
export function DataCard({
  title,
  badge,
  fields,
  children,
  tone,
}: {
  title: string;
  badge?: ReactNode;
  fields: readonly { label: string; value: string }[];
  children?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card tone={tone ?? 'default'}>
      <View style={styles.cardHead}>
        <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
          {title}
        </Text>
        {badge}
      </View>
      <View style={styles.fields}>
        {fields.map((f) => (
          <View key={f.label} style={styles.field}>
            <Text variant="caption" color="textMuted">
              {f.label}
            </Text>
            <Text variant="small">{f.value}</Text>
          </View>
        ))}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  skeleton: { gap: space.sm },
  skeletonRow: { width: '100%', borderRadius: radius.md },
  more: { gap: space.sm, alignItems: 'center' },
  tableScroll: { flexGrow: 1 },
  table: { flex: 1, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: layout.minTouchTarget + 8,
  },
  last: { borderBottomWidth: 0 },
  td: { paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  fields: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, columnGap: space.lg },
  field: { minWidth: 120, flexGrow: 1, flexBasis: '40%' },
});
