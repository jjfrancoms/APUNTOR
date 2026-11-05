import { StyleSheet } from 'react-native';
import { layout, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';

/**
 * Botón circular de 44 px; `label` es obligatorio para lectores de pantalla. `plain` quita el
 * fondo y el borde (cerrar una hoja, limpiar un campo) y conserva el área táctil completa.
 */
export function IconButton({
  icon,
  label,
  onPress,
  plain = false,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  plain?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        plain
          ? styles.plain
          : { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} size={18} color={plain ? 'textMuted' : undefined} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  // El margen alinea el ícono, no el área táctil, con el borde del contenido.
  plain: { borderWidth: 0, marginRight: -space.md },
  base: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
