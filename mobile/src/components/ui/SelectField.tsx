import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { Tap } from './Tap';

export interface SelectOption {
  value: string;
  label: string;
  detail?: string;
}

/**
 * Selector. Con `options` se despliega en línea, bajo el propio campo (sin hojas ni
 * ventanas encima), igual en móvil y escritorio. Sin `options` actúa como botón (`onPress`).
 */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  options,
  selected,
  onSelect,
  defaultOpen = false,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  options?: readonly SelectOption[];
  selected?: string;
  onSelect?: (value: string) => void;
  defaultOpen?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const shown = value ?? options?.find((o) => o.value === selected)?.label;
  const inline = options !== undefined;
  return (
    <View style={styles.wrap}>
      {label ? <Text variant="smallStrong">{label}</Text> : null}
      <Tap
        accessibilityRole="combobox"
        accessibilityState={inline ? { expanded: open } : undefined}
        accessibilityLabel={`${label ?? ''} ${shown ?? placeholder ?? ''}`.trim()}
        onPress={inline ? () => setOpen((o) => !o) : onPress}
        style={[
          styles.box,
          { backgroundColor: c.surface, borderColor: open ? c.primary : c.border },
        ]}
      >
        <Text variant="body" color={shown ? 'text' : 'textMuted'} style={styles.flex}>
          {shown ?? placeholder ?? ''}
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} color="textMuted" />
      </Tap>
      {inline && open ? (
        <View
          accessibilityRole="list"
          style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          {options.map((o, i) => {
            const active = o.value === selected;
            return (
              <Tap
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={o.detail ? `${o.label}, ${o.detail}` : o.label}
                onPress={() => {
                  setOpen(false);
                  onSelect?.(o.value);
                }}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.option,
                  i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
                  (pressed || hovered || active) && { backgroundColor: c.primarySoft },
                ]}
              >
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{o.label}</Text>
                  {o.detail ? (
                    <Text variant="caption" color="textMuted">
                      {o.detail}
                    </Text>
                  ) : null}
                </View>
                {active ? <Icon name="check" size={16} color="primary" /> : null}
              </Tap>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.primaryButtonHeight,
  },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: layout.minTouchTarget,
  },
  flex: { flex: 1 },
});
