import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useTheme, type ColorTokens } from '@/theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  size = 20,
  color = 'text',
}: {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens;
}) {
  const { c } = useTheme();
  return (
    <Feather
      name={name}
      size={size}
      color={c[color]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
