import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ProgressBar,
  Screen,
  FilterChips,
  Text,
  TopBar,
  type ChipTone,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { classOf, useStore, type ContentKind } from '@/store/store';
import { space } from '@/theme';
import { Tap } from '@/components/ui/Tap';

type Filter = 'all' | ContentKind;
const KIND_TONE: Record<ContentKind, ChipTone> = {
  definicion: 'primary',
  concepto: 'neutral',
  ejercicio: 'warning',
};
const KIND_ICON = { definicion: 'book', concepto: 'zap', ejercicio: 'edit-3' } as const;

/**
 * Vista de clase (nueva, a partir de los comentarios): todo lo que hay en los documentos de la
 * clase, filtrable por definiciones, conceptos y ejercicios, cada uno con su página de origen.
 */
export default function ClassDetail() {
  const s = useStrings();
  const cv = s.classView;
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const state = useStore((st) => st);
  const found = useMemo(() => classOf(state, classId), [state, classId]);
  const items = useMemo(
    () => state.items.filter((i) => i.classId === classId),
    [state.items, classId],
  );
  const [filter, setFilter] = useState<Filter>('all');
  if (!found) return <Screen header={<TopBar />}>{null}</Screen>;
  const { course, klass } = found;
  const count = (k: Filter) =>
    k === 'all' ? items.length : items.filter((i) => i.kind === k).length;
  const visible = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const filters: Filter[] = ['all', 'definicion', 'concepto', 'ejercicio'];
  const docName = (id: string) =>
    state.documents.find((d) => d.id === id)?.name.replace(/\.[^.]+$/u, '') ?? '';

  return (
    <Screen
      header={<TopBar title={klass.title} subtitle={course.title} />}
      footer={
        items.length > 0 ? (
          <>
            <Button
              label={cv.practice}
              onPress={() => router.push({ pathname: '/study/quiz-setup', params: { classId } })}
            />
            <Button
              label={cv.ask}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/conversation',
                  params: { q: `Resumen de ${klass.title.split(' · ')[1] ?? klass.title}` },
                })
              }
            />
          </>
        ) : (
          <Button label={s.course.addDocument} onPress={() => router.push('/upload')} />
        )
      }
    >
      <View style={styles.gapXs}>
        <View style={styles.row}>
          <Text variant="smallStrong" style={styles.flex}>
            {cv.progress}
          </Text>
          <Text variant="smallStrong" color="primary">
            {formatPercent(klass.progress)}
          </Text>
        </View>
        <ProgressBar value={klass.progress} label={klass.title} />
      </View>
      {items.length === 0 ? (
        <EmptyState mood="curious" title={s.classView.count(0)} body={cv.emptyClass} />
      ) : (
        <>
          <FilterChips
            options={filters.map((f) => ({ value: f, label: `${cv.filters[f]} · ${count(f)}` }))}
            value={filter}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <Text variant="small" color="textMuted" align="center">
              {cv.empty}
            </Text>
          ) : (
            visible.map((item) => (
              // La cita va al lado, no dentro, del botón: un botón dentro de otro queda fuera del
              // alcance de VoiceOver y TalkBack, y verificar la fuente no puede depender de eso.
              <Card key={item.id}>
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={`${cv.kind[item.kind]}: ${item.title}`}
                  onPress={() => router.push(`/courses/topics/${item.id}`)}
                  style={styles.itemBody}
                >
                  <View style={styles.row}>
                    <Chip
                      label={cv.kind[item.kind]}
                      tone={KIND_TONE[item.kind]}
                      icon={KIND_ICON[item.kind]}
                    />
                    <View style={styles.flex} />
                    <Icon name="chevron-right" size={16} color="textMuted" />
                  </View>
                  <Text variant="bodyStrong">{item.title}</Text>
                  <Text variant="small" numberOfLines={3}>
                    {item.text}
                  </Text>
                </Tap>
                <Tap
                  accessibilityRole="link"
                  accessibilityLabel={cv.source(docName(item.documentId), item.page)}
                  onPress={() => router.push(`/documents/${item.documentId}`)}
                  hitSlop={10}
                  style={styles.source}
                >
                  <Chip
                    label={cv.source(docName(item.documentId), item.page)}
                    tone="primary"
                    icon="file-text"
                  />
                </Tap>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  gapXs: { gap: space.xs },
  itemBody: { gap: space.sm },
  // Sin el máximo, un nombre de archivo largo saca la cita de la pantalla.
  source: { alignSelf: 'flex-start', maxWidth: '100%' },
});
