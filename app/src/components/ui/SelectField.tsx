import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Field, FIELD_HEIGHT, useFieldColors } from './Field';
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
  error,
  helper,
  disabled = false,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  options?: readonly SelectOption[];
  selected?: string;
  onSelect?: (value: string) => void;
  defaultOpen?: boolean;
  /** Mensaje de error bajo el campo (mismo marco que `TextField`). */
  error?: string;
  /** Texto de ayuda bajo el campo; se oculta mientras haya un error. */
  helper?: string;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const shown = value ?? options?.find((o) => o.value === selected)?.label;
  const inline = options !== undefined;
  const colors = useFieldColors({ focused: open, error, disabled });
  return (
    <View style={styles.wrap}>
      <Field label={label} helper={helper} error={error} ring={colors.ring}>
        <Tap
          accessibilityRole="combobox"
          accessibilityState={{ expanded: inline ? open : undefined, disabled }}
          accessibilityLabel={`${label ?? ''} ${shown ?? placeholder ?? ''}`.trim()}
          disabled={disabled}
          onPress={inline ? () => setOpen((o) => !o) : onPress}
          style={[
            styles.box,
            { backgroundColor: colors.background, borderColor: colors.border },
            disabled && styles.disabled,
          ]}
        >
          <Text
            variant="body"
            color={shown && !disabled ? 'text' : 'textMuted'}
            style={styles.flex}
          >
            {shown ?? placeholder ?? ''}
          </Text>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} color="textMuted" />
        </Tap>
      </Field>
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
                  active && { backgroundColor: c.primarySoft },
                  !active && (pressed || hovered) && { backgroundColor: c.surfaceAlt },
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
  wrap: { gap: space.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: FIELD_HEIGHT,
  },
  disabled: { opacity: 0.7 },
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
