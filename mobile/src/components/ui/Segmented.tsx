import { StyleSheet, View } from 'react-native';
import { layout, radius, useTheme } from '@/theme';
import { Text } from './Text';
import { Tap } from './Tap';

export function Segmented<T extends string>({
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
    <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Tap
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && { backgroundColor: c.surface }]}
          >
            <Text variant="smallStrong" color={active ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    minHeight: layout.minTouchTarget - 4,
  },
});
