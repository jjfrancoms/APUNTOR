import { Switch } from 'react-native';
import { useTheme } from '@/theme';

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ false: c.border, true: c.primary }}
      thumbColor={c.surface}
      ios_backgroundColor={c.border}
    />
  );
}
