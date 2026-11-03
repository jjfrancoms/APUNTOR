import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text, type IconName } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { layout, space, useTheme, navigationLayoutFor } from '@/theme';

export const TAB_ROUTES = ['home', 'courses', 'chat', 'profile'] as const;
type TabRoute = (typeof TAB_ROUTES)[number];

const ICONS: Record<TabRoute, IconName> = {
  home: 'home',
  courses: 'book-open',
  chat: 'message-circle',
  profile: 'user',
};

/**
 * Barra de navegación: inferior en móvil (< 600 px) con el botón "+" central;
 * lateral de 88 px en tablet y de 280 px en escritorio (docs/producto/mvp-ux.md §7).
 */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const s = useStrings();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const mode = navigationLayoutFor(width);
  const vertical = mode !== 'bottom-bar';

  const items = state.routes
    .filter((r): r is typeof r & { name: TabRoute } =>
      (TAB_ROUTES as readonly string[]).includes(r.name),
    )
    .map((route) => {
      const focused = state.routes[state.index]?.key === route.key;
      const label = s.tabs[route.name];
      return (
        <Pressable
          key={route.key}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: focused }}
          onPress={() => navigateToTab(route.key)}
          style={[
            styles.item,
            mode === 'sidebar' && styles.itemWide,
            mode === 'sidebar' && focused && { backgroundColor: c.primarySoft },
          ]}
        >
          <Icon name={ICONS[route.name]} size={22} color={focused ? 'primary' : 'textMuted'} />
          <Text
            variant={mode === 'sidebar' ? 'bodyStrong' : 'caption'}
            color={focused ? 'primary' : 'textMuted'}
          >
            {label}
          </Text>
        </Pressable>
      );
    });

  const upload = (
    <Pressable
      key="upload"
      accessibilityRole="button"
      accessibilityLabel={s.tabs.upload}
      onPress={() => router.push('/upload')}
      style={[styles.item, mode === 'sidebar' && styles.itemWide]}
    >
      <View style={[styles.fab, { backgroundColor: c.primary }]}>
        <Icon name="plus" size={24} color="onPrimary" />
      </View>
      {mode === 'sidebar' ? <Text variant="bodyStrong">{s.tabs.upload}</Text> : null}
    </Pressable>
  );

  const ordered = vertical ? [upload, ...items] : [items[0], items[1], upload, items[2], items[3]];

  return (
    <View
      accessibilityRole="tablist"
      style={[
        vertical ? styles.rail : styles.bar,
        { backgroundColor: c.surface, borderColor: c.border },
        vertical
          ? {
              width: mode === 'sidebar' ? layout.sidebarWidth.desktop : layout.sidebarWidth.tablet,
              paddingTop: insets.top + space.lg,
            }
          : { paddingBottom: Math.max(insets.bottom, space.sm) },
        mode === 'sidebar' && styles.railWide,
      ]}
    >
      {ordered}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
  rail: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: space.md,
    borderRightWidth: 1,
    height: '100%',
  },
  railWide: { alignItems: 'stretch', paddingHorizontal: space.lg },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    paddingHorizontal: space.xs,
  },
  itemWide: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: 12,
    minHeight: 48,
  },
  fab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
