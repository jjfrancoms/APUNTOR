import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Tap, type TapState } from './Tap';

export interface ListRowProps {
  title: string;
  detail?: string;
  icon?: IconName;
  /** Medio propio a la izquierda (miniatura, avatar…); reemplaza al ícono. */
  media?: ReactNode;
  /** Control a la derecha (interruptor, chip…). Si no hay y hay onPress, muestra chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  divider?: boolean;
  /** Acción destructiva: título e ícono en rojo. */
  danger?: boolean;
}

/**
 * Fila de lista (referencia: shadcn Item): ícono plano a la izquierda, título y descripción, y
 * chevron a la derecha si se puede tocar. Al presionar o pasar el puntero se tiñe el fondo.
 */
export function ListRow({
  title,
  detail,
  icon,
  media,
  trailing,
  onPress,
  divider = true,
  danger = false,
}: ListRowProps) {
  const { c } = useTheme();
  const content = (shade: string) => (
    <View
      style={[
        styles.row,
        { backgroundColor: shade },
        divider && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      {media ??
        (icon ? (
          <View style={styles.media}>
            <Icon name={icon} size={20} color={danger ? 'danger' : 'textMuted'} />
          </View>
        ) : null)}
      <View style={styles.text}>
        <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>
          {title}
        </Text>
        {detail ? (
          <Text variant="caption" color="textMuted">
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-right" size={18} color="textMuted" /> : null)}
    </View>
  );
  if (!onPress) return content('transparent');
  return (
    <Tap accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {({ pressed, hovered }: TapState) =>
        content(pressed ? c.surfaceAlt : hovered === true ? c.bg : 'transparent')
      }
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 12,
  },
  // Ícono sin recuadro de color; el ancho fijo alinea los títulos de todas las filas.
  media: { width: 24, alignItems: 'flex-start' },
  text: { flex: 1, gap: 2 },
});
