import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BannerTone = 'warning' | 'danger' | 'info' | 'external';

/** Aviso con ícono + texto (nunca solo color). El ámbar es fondo; el texto usa el color principal. */
export function Banner({
  tone,
  title,
  body,
  icon,
  children,
}: {
  tone: BannerTone;
  title: string;
  body?: string;
  icon?: IconName;
  children?: ReactNode;
}) {
  const { c } = useTheme();
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
    external: { bg: c.externalSoft, border: c.external, fg: 'external', icon: 'globe' },
  };
  const t = tones[tone];
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <View style={styles.row}>
        <Icon name={icon ?? t.icon} size={16} color={t.fg} />
        <Text variant="smallStrong" color={t.fg} style={styles.flex}>
          {title}
        </Text>
      </View>
      {body ? <Text variant="caption">{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.xs + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
