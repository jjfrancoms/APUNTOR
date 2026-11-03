import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Tap } from './Tap';

export function Checkbox({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  children: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Tap
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? c.primary : c.border,
            backgroundColor: checked ? c.primary : c.surface,
          },
        ]}
      >
        {checked ? <Icon name="check" size={14} color="onPrimary" /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm - 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
