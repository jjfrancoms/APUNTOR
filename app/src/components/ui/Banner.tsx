import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { TextLink } from './TextLink';

export type BannerTone = 'warning' | 'danger' | 'info' | 'external' | 'success';

/**
 * Aviso (referencia: HeroUI Alert): ícono a la izquierda, título y texto alineados a la izquierda,
 * acción opcional y botón de cerrar opcional. Nunca solo color: siempre ícono + texto. El ámbar
 * es fondo; el texto usa el color principal.
 */
export function Banner({
  tone,
  title,
  body,
  icon,
  children,
  onClose,
  action,
}: {
  tone: BannerTone;
  title: string;
  body?: string;
  icon?: IconName;
  children?: ReactNode;
  /** Muestra el botón de cerrar; el aviso lo oculta quien lo pinta. */
  onClose?: () => void;
  /** Acción en texto bajo el mensaje (Reintentar, Ver más…). */
  action?: { label: string; onPress?: () => void };
}) {
  const { c } = useTheme();
  const s = useStrings();
  const tones: Record<
    BannerTone,
    {
      bg: string;
      border: string;
      fg: Exclude<keyof ColorTokens, 'accent' | 'accentSoft' | 'scrim'>;
      icon: IconName;
    }
  > = {
    warning: { bg: c.accentSoft, border: c.accentSoft, fg: 'text', icon: 'alert-triangle' },
    danger: { bg: c.dangerSoft, border: c.dangerSoft, fg: 'danger', icon: 'alert-triangle' },
    info: { bg: c.primarySoft, border: c.primarySoft, fg: 'primary', icon: 'info' },
    success: { bg: c.primarySoft, border: c.primary, fg: 'primary', icon: 'check-circle' },
    external: { bg: c.externalSoft, border: c.external, fg: 'external', icon: 'globe' },
  };
  const t = tones[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <View style={styles.icon}>
        <Icon name={icon ?? t.icon} size={18} color={t.fg} />
      </View>
      <View style={styles.content}>
        <Text variant="smallStrong" color={t.fg}>
          {title}
        </Text>
        {body ? <Text variant="caption">{body}</Text> : null}
        {children}
        {action ? (
          <View style={styles.action}>
            <TextLink label={action.label} onPress={action.onPress} color={t.fg} />
          </View>
        ) : null}
      </View>
      {onClose ? (
        <IconButton plain edge="end" icon="x" label={s.common.close} onPress={onClose} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
  },
  icon: { paddingTop: 1 },
  content: { flex: 1, gap: space.xs + 2 },
  action: { alignSelf: 'flex-start' },
});
