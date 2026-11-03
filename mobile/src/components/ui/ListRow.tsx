import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { layout, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  detail?: string;
  icon?: IconName;
  /** Control a la derecha (interruptor, chip…). Si no hay y hay onPress, muestra chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  /** Acción destructiva: título e ícono en rojo. */
  danger?: boolean;
}

export function ListRow({
  title,
  detail,
  icon,
  trailing,
  onPress,
  divider = true,
  danger = false,
}: ListRowProps) {
  const { c } = useTheme();
  const content = (
    <View
      style={[
        styles.row,
        divider && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={danger ? 'danger' : 'primary'} /> : null}
      <View style={styles.text}>
        <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-right" size={18} color="textMuted" /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 12,
  },
  text: { flex: 1, gap: 2 },
});
