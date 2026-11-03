import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { Button } from './Button';
import { Mascot, type MascotMood } from './Mascot';
import { Text } from './Text';

/** Estado vacío / error de pantalla completa (pantallas 8, 45–50): mascota, mensaje y acciones. */
export function EmptyState({
  mood = 'curious',
  title,
  body,
  primary,
  secondary,
}: {
  mood?: MascotMood;
  title: string;
  body: string;
  primary?: { label: string; onPress?: () => void };
  secondary?: { label: string; onPress?: () => void };
}) {
  return (
    <View style={styles.wrap}>
      <Mascot size={110} mood={mood} halo />
      <Text variant="heading" align="center" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="small" color="textMuted" align="center">
        {body}
      </Text>
      <View style={styles.actions}>
        {primary ? <Button label={primary.label} onPress={primary.onPress} /> : null}
        {secondary ? (
          <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.xxxl,
  },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
