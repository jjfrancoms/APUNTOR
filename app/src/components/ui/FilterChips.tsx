import { ScrollView, StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Text } from './Text';
import { Tap } from './Tap';

/**
 * Filtros en chips desplazables: no se parten en dos líneas aunque haya muchas opciones.
 * Con `wrap`, los chips bajan a otra línea en vez de desplazarse (navegación con pocas opciones,
 * para que la seleccionada nunca quede cortada en el borde).
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  wrap = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  const { c } = useTheme();
  const chips = options.map((o) => {
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
  });
  if (wrap) {
    return (
      <View style={styles.wrap} accessibilityRole="tablist">
        {chips}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Sin esto, dentro de una columna flexible el carrusel crece y estira los chips a lo alto.
      style={styles.scroll}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: space.sm, paddingRight: space.lg, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
});
