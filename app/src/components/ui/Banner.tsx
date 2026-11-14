import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useStrings } from '@/i18n/es';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ease, motion, radius, space, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';
import { TextLink } from './TextLink';

export type BannerTone = 'warning' | 'danger' | 'info' | 'external' | 'success';

/** Cuánto sube (px) el aviso al entrar y baja al salir: corto, solo para dar dirección. */
const SHIFT = 6;

/**
 * Aviso (referencia: HeroUI Alert): ícono a la izquierda, título y texto alineados a la izquierda,
 * acción opcional y botón de cerrar opcional. Nunca solo color: siempre ícono + texto. El ámbar
 * es fondo; el texto usa el color principal. Entra con un fundido corto y, al cerrarlo con
 * `onClose`, sale con otro antes de avisar (sin animar con «reducir movimiento»).
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
  const reduced = useReducedMotion();
  const shown = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const animate = (to: number, duration: number, done?: () => void) => {
    Animated.timing(shown, {
      toValue: to,
      duration,
      easing: to === 1 ? ease.out : ease.inOut,
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) done?.();
    });
  };
  useEffect(() => {
    if (reduced) shown.setValue(1);
    else animate(1, motion.duration.base);
    // Solo al montar (o si cambia la preferencia): el aviso no se anima en cada render.
  }, [reduced]);
  const close = onClose
    ? () => (reduced ? onClose() : animate(0, motion.duration.fast, onClose))
    : undefined;
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [-SHIFT, 0] });
  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        styles.box,
        { backgroundColor: t.bg, borderColor: t.border },
        { opacity: shown, transform: [{ translateY }] },
      ]}
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
      {close ? (
        <IconButton plain edge="end" icon="x" label={s.common.close} onPress={close} />
      ) : null}
    </Animated.View>
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
