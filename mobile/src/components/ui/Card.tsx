import { StyleSheet, View, type ViewProps } from 'react-native';
import { radius, space, useTheme } from '@/theme';

export type CardTone = 'default' | 'primary' | 'external' | 'accent' | 'danger';

export function Card({ tone = 'default', style, ...rest }: ViewProps & { tone?: CardTone }) {
  const { c } = useTheme();
  const tones = {
    default: { bg: c.surface, border: c.border },
    primary: { bg: c.primarySoft, border: c.primarySoft },
    external: { bg: c.surface, border: c.external },
    accent: { bg: c.accentSoft, border: c.accentSoft },
    danger: { bg: c.dangerSoft, border: c.danger },
  } as const;
  const t = tones[tone];
  return (
    <View
      {...rest}
      style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }, style]}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
});
