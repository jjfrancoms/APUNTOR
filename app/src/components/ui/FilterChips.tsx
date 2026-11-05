import { ScrollView, StyleSheet } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Text } from './Text';
import { Tap } from './Tap';

/** Filtros en chips desplazables: no se parten en dos líneas aunque haya muchas opciones. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Sin esto, dentro de una columna flexible el carrusel crece y estira los chips a lo alto.
      style={styles.scroll}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Tap
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? c.primary : c.surface,
                borderColor: active ? c.primary : c.border,
              },
            ]}
          >
            <Text variant="smallStrong" color={active ? 'onPrimary' : 'text'} numberOfLines={1}>
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: space.sm, paddingRight: space.lg, alignItems: 'center' },
  chip: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
});
