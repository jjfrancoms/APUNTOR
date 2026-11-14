import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { space, useWide } from '@/theme';
import { Button } from './Button';
import { Mascot, type MascotMood } from './Mascot';
import { Text } from './Text';

/**
 * Estado vacío / error de pantalla completa (pantallas 8, 45–50; referencia: empty-state de
 * robertlib). Illari (pequeña, sin halo ni fondo de color) va en la ranura de medio y el texto se alinea a la izquierda: en pantallas
 * anchas (≥ 600 px) la mascota queda a la izquierda del texto y los botones en fila; en móvil
 * todo va en columna y los botones ocupan el ancho.
 */
export function EmptyState({
  mood = 'curious',
  title,
  body,
  primary,
  secondary,
  media,
}: {
  mood?: MascotMood;
  title: string;
  body: string;
  primary?: { label: string; onPress?: () => void };
  secondary?: { label: string; onPress?: () => void };
  /** Sustituye a la mascota (otra ilustración). */
  media?: ReactNode;
}) {
  const wide = useWide();
  return (
    <View style={styles.wrap}>
      <View style={[styles.content, wide && styles.contentWide]}>
        {media ?? <Mascot size={wide ? 96 : 72} mood={mood} />}
        <View style={styles.text}>
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="muted">{body}</Text>
          {primary || secondary ? (
            <View style={[styles.actions, wide && styles.actionsWide]}>
              {primary ? <Button label={primary.label} onPress={primary.onPress} /> : null}
              {secondary ? (
                <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centrado vertical en la pantalla, pero el contenido va pegado a la izquierda.
  wrap: { flex: 1, justifyContent: 'center', paddingVertical: space.xxxl },
  content: { gap: space.lg, alignItems: 'flex-start' },
  contentWide: { flexDirection: 'row', alignItems: 'center', gap: space.xxl },
  text: { gap: space.sm, alignSelf: 'stretch', flexShrink: 1, maxWidth: 480 },
  actions: { gap: space.sm, marginTop: space.md, alignSelf: 'stretch' },
  actionsWide: { flexDirection: 'row', alignSelf: 'flex-start' },
});
