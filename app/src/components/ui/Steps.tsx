import { StyleSheet, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type StepStatus = 'done' | 'active' | 'pending' | 'error';

export interface StepItem {
  title: string;
  description?: string;
  status: StepStatus;
}

/**
 * Pasos en vertical con descripción (referencia: Steps de adit-firdaus), p. ej. el
 * procesamiento de una subida. Cada paso lleva un indicador con ícono (nunca solo color), unido
 * al siguiente por una línea. Se lee como una lista; el estado va en el nombre accesible.
 */
export function Steps({
  items,
  statusLabels,
}: {
  items: readonly StepItem[];
  /** Texto de cada estado para lectores de pantalla (“completado”, “en curso”…), desde i18n. */
  statusLabels?: Readonly<Record<StepStatus, string>>;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="list" style={styles.list}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const done = item.status === 'done';
        const active = item.status === 'active';
        const error = item.status === 'error';
        return (
          <View
            key={`${i}-${item.title}`}
            accessible
            accessibilityRole="text"
            accessibilityLabel={[item.title, statusLabels?.[item.status], item.description]
              .filter(Boolean)
              .join(', ')}
            style={styles.item}
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? c.primary : error ? c.dangerSoft : c.surface,
                    borderColor: error ? c.danger : done || active ? c.primary : c.border,
                  },
                ]}
              >
                {done ? (
                  <Icon name="check" size={14} color="onPrimary" />
                ) : error ? (
                  <Icon name="x" size={14} color="danger" />
                ) : active ? (
                  <View style={[styles.pulse, { backgroundColor: c.primary }]} />
                ) : null}
              </View>
              {last ? null : (
                <View style={[styles.line, { backgroundColor: done ? c.primary : c.border }]} />
              )}
            </View>
            <View style={[styles.body, last ? null : styles.bodyGap]}>
              <Text
                variant="bodyStrong"
                color={error ? 'danger' : done || active ? 'text' : 'textMuted'}
              >
                {item.title}
              </Text>
              {item.description ? (
                <Text variant="caption" color="textMuted">
                  {item.description}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  list: { alignItems: 'stretch' },
  item: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: DOT },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, flex: 1, minHeight: space.md, marginVertical: 2 },
  body: { flex: 1, gap: 2, paddingTop: 2 },
  bodyGap: { paddingBottom: space.lg },
});
