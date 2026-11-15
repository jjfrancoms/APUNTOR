import { View } from 'react-native';
import { layout, space } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text, type AppTextProps } from './Text';
import { Tap, type TapState } from './Tap';

/**
 * Enlace de texto (referencia: react-aria link): color de marca, subrayado al pasar el puntero o
 * presionar y anillo de foco de teclado (lo pinta `WebChrome`). Alinea a la izquierda.
 */
export function TextLink({
  label,
  onPress,
  variant = 'smallStrong',
  color = 'primary',
  role = 'button',
  icon,
}: {
  label: string;
  onPress?: () => void;
  variant?: AppTextProps['variant'];
  color?: AppTextProps['color'];
  /** 'button' para acciones (Editar, Cambiar…); 'link' solo para abrir documentos o páginas. */
  role?: 'button' | 'link';
  /** Ícono plano a la izquierda de la etiqueta. */
  icon?: IconName;
}) {
  return (
    <Tap
      accessibilityRole={role}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={{ minHeight: layout.minTouchTarget - 20, justifyContent: 'center' }}
    >
      {({ pressed, hovered }: TapState) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
          {icon ? <Icon name={icon} size={14} color={color ?? 'primary'} /> : null}
          <Text
            variant={variant}
            color={color}
            style={{ textDecorationLine: pressed || hovered === true ? 'underline' : 'none' }}
          >
            {label}
          </Text>
        </View>
      )}
    </Tap>
  );
}
