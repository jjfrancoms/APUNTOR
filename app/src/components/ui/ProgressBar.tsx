import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

export function ProgressBar({
  value,
  tone = 'primary',
  label,
}: {
  value: number;
  tone?: 'primary' | 'accent';
  label: string;
}) {
  const { c } = useTheme();
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { backgroundColor: c.surfaceAlt }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: tone === 'primary' ? c.primary : c.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
