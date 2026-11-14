import { StyleSheet, View } from 'react-native';
import { motion, radius, space, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { Tap, type TapState } from './Tap';

export type ChipTone = 'primary' | 'external' | 'warning' | 'danger' | 'neutral';

/**
 * Etiqueta compacta en píldora. Con `onPress` se vuelve tocable (referencia: Citation de
 * redrob-labs): borde del color del tono, flecha al final y un área táctil ampliada con `hitSlop`.
 */
export function Chip({
  label,
  tone = 'neutral',
  icon,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  label: string;
  tone?: ChipTone;
  icon?: IconName;
  onPress?: () => void;
  /** Nombre para lectores de pantalla cuando el chip es tocable (si no, usa `label`). */
  accessibilityLabel?: string;
  /** 'link' para abrir un documento o una página; 'button' para acciones. */
  accessibilityRole?: 'button' | 'link';
}) {
  const { c } = useTheme();
  // El ámbar nunca es texto: los avisos usan fondo ámbar suave con texto principal.
  const tones: Record<
    ChipTone,
    { bg: string; fg: Exclude<keyof ColorTokens, 'accent' | 'accentSoft' | 'scrim'> }
  > = {
    primary: { bg: c.primarySoft, fg: 'primary' },
    external: { bg: c.externalSoft, fg: 'external' },
    warning: { bg: c.accentSoft, fg: 'text' },
    danger: { bg: c.dangerSoft, fg: 'danger' },
    neutral: { bg: c.surfaceAlt, fg: 'textMuted' },
  };
  const t = tones[tone];
  const content = (
    <>
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : null}
      <Text variant="caption" color={t.fg} numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      {onPress ? <Icon name="chevron-right" size={12} color={t.fg} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.bg }]}>{content}</View>
    );
  }
  return (
    <Tap
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      // El chip mide ~26 px de alto: el área táctil llega a 44 px con este margen.
      hitSlop={10}
      pressScale={motion.pressScale}
      style={({ pressed, hovered }: TapState) => [
        styles.chip,
        { backgroundColor: t.bg, borderColor: pressed || hovered === true ? t.bg : c[t.fg] },
      ]}
    >
      {content}
    </Tap>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
});
