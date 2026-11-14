import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout } from '@/theme';
import { useStrings } from '@/i18n/es';
import { entryRoute, useStore } from '@/store/store';
import { IconButton } from './IconButton';
import { Text } from './Text';

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
        icon={icon}
        label={icon === 'x' ? s.common.close : s.common.back}
        onPress={back}
      />
      <View style={styles.title}>
        <Text variant="subheading" align="center" accessibilityRole="header" numberOfLines={1}>
          {title ?? ''}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" align="center" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTouchTarget + 8 },
  title: { flex: 1 },
  side: { width: layout.minTouchTarget, alignItems: 'flex-end' },
});
