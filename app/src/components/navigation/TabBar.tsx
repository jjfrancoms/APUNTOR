import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Avatar, BrandLogo, Icon, Text, type IconName } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { updateSettings, useStore } from '@/store/store';
import { layout, radius, space, useTheme, navigationLayoutFor } from '@/theme';
import { Tap, type TapState } from '@/components/ui/Tap';

export const TAB_ROUTES = ['home', 'courses', 'chat', 'profile'] as const;
type TabRoute = (typeof TAB_ROUTES)[number];

const ICONS: Record<TabRoute, IconName> = {
  home: 'home',
  courses: 'book-open',
  chat: 'message-circle',
  profile: 'user',
};

/**
 * Barra de navegación (docs/producto/mvp-ux.md §7):
 * - móvil (< 600 px): barra inferior con pestañas redondeadas (la activa lleva una píldora suave
 *   detrás del ícono; referencia Origin UI) y el botón "+" central;
 * - tablet: riel de 88 px con solo íconos y etiqueta corta;
 * - escritorio (≥ 1024 px): barra lateral de 280 px (referencia shadcn Sidebar) con el logo, la
 *   acción principal, el grupo de navegación con el elemento activo en `primarySoft`, y al pie
 *   el cambio de tema y el perfil.
 */
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const s = useStrings();
  const { c, mode: colorMode } = useTheme();
  const fullName = useStore((st) => st.session?.fullName ?? '');
  const email = useStore((st) => st.session?.email ?? '');
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
        <Tap
          key={route.key}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: focused }}
          onPress={() => navigateToTab(route.key)}
          style={({ hovered }: TapState) => [
            styles.item,
            mode === 'sidebar' && styles.itemWide,
            mode === 'sidebar' && {
              backgroundColor: focused
                ? c.primarySoft
                : hovered === true
                  ? c.surfaceAlt
                  : undefined,
            },
          ]}
        >
          {mode === 'sidebar' ? (
            <Icon name={ICONS[route.name]} size={20} color={focused ? 'primary' : 'textMuted'} />
          ) : (
            // Píldora de la pestaña activa: no depende solo del color (forma + etiqueta en negrita).
            <View style={[styles.pill, focused && { backgroundColor: c.primarySoft }]}>
              <Icon name={ICONS[route.name]} size={22} color={focused ? 'primary' : 'textMuted'} />
            </View>
          )}
          <Text
            variant={mode === 'sidebar' ? 'bodyStrong' : focused ? 'smallStrong' : 'caption'}
            color={focused ? 'primary' : 'textMuted'}
            // La barra inferior tiene alto fijo: con texto muy grande cortaría las etiquetas.
            maxFontSizeMultiplier={mode === 'sidebar' ? undefined : 1.3}
          >
            {label}
          </Text>
        </Tap>
      );
    });

  const sidebar = mode === 'sidebar';
  const upload = (
    <Tap
      key="upload"
      accessibilityRole="button"
      accessibilityLabel={s.tabs.upload}
      onPress={() => router.push('/upload')}
      style={({ pressed, hovered }: TapState) => [
        sidebar ? [styles.uploadWide, { backgroundColor: c.primary }] : styles.item,
        { opacity: pressed ? 0.85 : hovered === true ? 0.92 : 1 },
      ]}
    >
      {sidebar ? (
        <>
          <Icon name="plus" size={20} color="onPrimary" />
          <Text variant="bodyStrong" color="onPrimary">
            {s.tabs.upload}
          </Text>
        </>
      ) : (
        <View style={[styles.fab, { backgroundColor: c.primary }]}>
          <Icon name="plus" size={24} color="onPrimary" />
        </View>
      )}
    </Tap>
  );

  // Cambio rápido de tema; en Perfil › Apariencia también se puede volver a "Automático".
  const nextTheme = colorMode === 'dark' ? 'light' : 'dark';
  const themeLabel = colorMode === 'dark' ? s.tabs.toLight : s.tabs.toDark;
  const themeToggle = (
    <Tap
      key="theme"
      accessibilityRole="button"
      accessibilityLabel={themeLabel}
      onPress={() => updateSettings({ theme: nextTheme })}
      style={({ hovered }: TapState) => [
        styles.item,
        sidebar && [
          styles.itemWide,
          styles.flexNone,
          { backgroundColor: hovered === true ? c.surfaceAlt : undefined },
        ],
      ]}
    >
      <Icon name={colorMode === 'dark' ? 'sun' : 'moon'} size={20} color="textMuted" />
      {sidebar ? (
        <Text variant="smallStrong" color="textMuted">
          {themeLabel}
        </Text>
      ) : null}
    </Tap>
  );

  if (!vertical) {
    return (
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          { backgroundColor: c.surface, borderColor: c.border },
          { paddingBottom: Math.max(insets.bottom, space.sm) },
        ]}
      >
        {[items[0], items[1], upload, items[2], items[3]]}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.rail,
        { backgroundColor: c.surface, borderColor: c.border },
        {
          width: sidebar ? layout.sidebarWidth.desktop : layout.sidebarWidth.tablet,
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.lg,
        },
        sidebar && styles.railWide,
      ]}
    >
      {sidebar ? (
        <View style={styles.brand}>
          <BrandLogo variant="horizontal" size={28} />
          <Text variant="caption" color="textMuted">
            {s.tabs.tagline}
          </Text>
        </View>
      ) : (
        <BrandLogo variant="isotipo" size={36} />
      )}
      {upload}
      {sidebar ? <View style={[styles.divider, { backgroundColor: c.border }]} /> : null}
      <View style={[styles.nav, sidebar && styles.navWide]}>{items}</View>
      <View style={styles.spacer} />
      {themeToggle}
      {sidebar && fullName ? (
        <Tap
          accessibilityRole="button"
          accessibilityLabel={`${s.tabs.profile}: ${fullName}`}
          onPress={() => router.navigate('/profile')}
          style={[styles.user, { borderColor: c.border }]}
        >
          <Avatar name={fullName} size="sm" />
          <View style={styles.flex}>
            <Text variant="smallStrong" numberOfLines={1}>
              {fullName}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {email}
            </Text>
          </View>
        </Tap>
      ) : null}
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
  railWide: { alignItems: 'stretch', paddingHorizontal: space.lg, gap: space.lg },
  brand: { gap: space.xs, paddingHorizontal: space.xs },
  nav: { gap: space.md, alignItems: 'center' },
  navWide: { gap: space.xs, alignItems: 'stretch' },
  spacer: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  flexNone: { minHeight: 40 },
  uploadWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.md,
    minHeight: 48,
    borderRadius: radius.md,
  },
  user: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
    paddingHorizontal: space.xs,
  },
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
    borderRadius: radius.md,
    minHeight: 48,
  },
  // El centrado es del ícono dentro de su píldora o del botón redondo.
  pill: {
    width: 56,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
