import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, space } from '@/theme';
import { useStrings } from '@/i18n/es';
import { entryRoute, useStore } from '@/store/store';
import { IconButton } from './IconButton';
import { Text } from './Text';

/**
 * Barra superior tranquila: volver (o cerrar) a la izquierda, título y subtítulo alineados a la
 * izquierda y una acción opcional a la derecha. Sin fondo ni borde: se apoya en el de la pantalla.
 */
export function TopBar({
  title,
  subtitle,
  right,
  icon = 'arrow-left',
  onBack,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  icon?: 'arrow-left' | 'x';
  onBack?: () => void;
}) {
  const s = useStrings();
  // Sin historial (recarga o enlace directo) se vuelve al inicio o al acceso según la sesión;
  // nunca a `/`, que en web es la página pública.
  const home = useStore(entryRoute);
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(home)));
  return (
    <View style={styles.bar}>
      <IconButton
        plain
        edge="start"
        icon={icon === 'x' ? 'x' : 'chevron-left'}
        label={icon === 'x' ? s.common.close : s.common.back}
        onPress={back}
      />
      <View style={styles.title}>
        <Text variant="subheading" accessibilityRole="header" numberOfLines={1}>
          {title ?? ''}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.side}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // El título queda junto al botón de volver; el área táctil del botón sobresale del margen.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget + 8,
  },
  title: { flex: 1, minWidth: 0 },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
