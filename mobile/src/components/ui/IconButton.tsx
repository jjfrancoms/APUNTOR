import { StyleSheet } from 'react-native';
import { layout, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';

/** Botón circular de 44 px; `label` es obligatorio para lectores de pantalla. */
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
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
        { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} size={18} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
