import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Tap } from './Tap';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'dangerOutline' | 'soft';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Tamaño compacto (44 px) para acciones secundarias dentro de tarjetas. */
  compact?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  compact,
}: ButtonProps) {
  const { c } = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: 'onPrimary', border: c.primary },
    secondary: { bg: c.surface, fg: 'text', border: c.border },
    danger: { bg: c.danger, fg: 'onPrimary', border: c.danger },
    soft: { bg: c.surface, fg: 'primary', border: c.border },
    dangerOutline: { bg: c.surface, fg: 'danger', border: c.danger },
  } as const;
  const p = palette[variant];
  const inactive = disabled === true || loading === true;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: compact ? layout.minTouchTarget : layout.primaryButtonHeight,
          backgroundColor: p.bg,
          borderColor: p.border,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
          paddingHorizontal: compact ? space.md : space.lg,
        },
      ]}
    >
      {loading === true ? (
        <ActivityIndicator color={c[p.fg]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={16} color={p.fg} /> : null}
          <Text variant={compact ? 'smallStrong' : 'bodyStrong'} color={p.fg}>
            {label}
          </Text>
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
