import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout } from '@/theme';
import { useStrings } from '@/i18n/es';
import { IconButton } from './IconButton';
import { Text } from './Text';

export function TopBar({
  title,
  right,
  icon = 'arrow-left',
  onBack,
}: {
  title?: string;
  right?: ReactNode;
  icon?: 'arrow-left' | 'x';
  onBack?: () => void;
}) {
  const s = useStrings();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.bar}>
      <IconButton
        icon={icon}
        label={icon === 'x' ? s.common.close : s.common.back}
        onPress={back}
      />
      <Text
        variant="subheading"
        align="center"
        style={styles.title}
        accessibilityRole="header"
        numberOfLines={1}
      >
        {title ?? ''}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTouchTarget + 8 },
  title: { flex: 1 },
  side: { width: layout.minTouchTarget, alignItems: 'flex-end' },
});
