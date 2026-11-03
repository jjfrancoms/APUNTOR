import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ChipTone = 'primary' | 'external' | 'warning' | 'danger' | 'neutral';

export function Chip({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
}) {
  const { c } = useTheme();
  // El ámbar nunca es texto: los avisos usan fondo ámbar suave con texto principal.
  const tones: Record<
    ChipTone,
    { bg: string; fg: Exclude<keyof ColorTokens, 'accent' | 'accentSoft'> }
  > = {
    primary: { bg: c.primarySoft, fg: 'primary' },
    external: { bg: c.externalSoft, fg: 'external' },
    warning: { bg: c.accentSoft, fg: 'text' },
    danger: { bg: c.dangerSoft, fg: 'danger' },
    neutral: { bg: c.surfaceAlt, fg: 'textMuted' },
  };
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : null}
      <Text variant="caption" color={t.fg} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
});
