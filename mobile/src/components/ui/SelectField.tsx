import { Pressable, StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Selector cerrado (el desplegable real llega con los datos). */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text variant="smallStrong">{label}</Text> : null}
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`${label ?? ''} ${value ?? placeholder ?? ''}`.trim()}
        onPress={onPress}
        style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Text variant="body" color={value ? 'text' : 'textMuted'} style={styles.flex}>
          {value ?? placeholder ?? ''}
        </Text>
        <Icon name="chevron-down" color="textMuted" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.primaryButtonHeight,
  },
  flex: { flex: 1 },
});
