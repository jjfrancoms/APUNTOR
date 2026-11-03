import { layout } from '@/theme';
import { Text, type AppTextProps } from './Text';
import { Tap } from './Tap';

export function TextLink({
  label,
  onPress,
  variant = 'smallStrong',
  color = 'primary',
  role = 'button',
}: {
  label: string;
  onPress?: () => void;
  variant?: AppTextProps['variant'];
  color?: AppTextProps['color'];
  /** 'button' para acciones (Editar, Cambiar…); 'link' solo para abrir documentos o páginas. */
  role?: 'button' | 'link';
}) {
  return (
    <Tap
      accessibilityRole={role}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={{ minHeight: layout.minTouchTarget - 20, justifyContent: 'center' }}
    >
      <Text variant={variant} color={color}>
        {label}
      </Text>
    </Tap>
  );
}
