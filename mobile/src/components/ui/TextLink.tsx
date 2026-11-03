import { Pressable } from 'react-native';
import { layout } from '@/theme';
import { Text, type AppTextProps } from './Text';

export function TextLink({
  label,
  onPress,
  variant = 'smallStrong',
  color = 'primary',
}: {
  label: string;
  onPress?: () => void;
  variant?: AppTextProps['variant'];
  color?: AppTextProps['color'];
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={{ minHeight: layout.minTouchTarget - 20, justifyContent: 'center' }}
    >
      <Text variant={variant} color={color}>
        {label}
      </Text>
    </Pressable>
  );
}
