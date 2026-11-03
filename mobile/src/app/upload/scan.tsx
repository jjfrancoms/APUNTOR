import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Chip, EmptyState, Icon, IconButton, Screen, Text, TopBar } from '@/components/ui';
import { scanReading } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { palettes, radius, space, useTheme } from '@/theme';

/** Pantalla 28 · Escanear apunte. Visor simulado: la cámara real llega con expo-camera. */
export default function Scan() {
  const s = useStrings();
  const { c } = useTheme();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  // Pantalla 47 · Cámara denegada.
  if (demo === 'denied') {
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {s.scanner.header}
        </Text>
        <EmptyState
          mood="worried"
          title={s.empty.cameraTitle}
          body={s.empty.cameraBody}
          primary={{ label: s.empty.openSettings, onPress: () => void Linking.openSettings() }}
          secondary={{
            label: s.empty.pickGallery,
            onPress: () => router.push('/upload/scan-review'),
          }}
        />
      </Screen>
    );
  }
  return (
    <Screen
      header={
        <TopBar
          icon="x"
          title={s.scanner.header}
          subtitle={s.scanner.page(2)}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.scanner.done}
              onPress={() => router.push('/upload/scan-review')}
              hitSlop={8}
            >
              <Chip label={s.scanner.done} tone="primary" />
            </Pressable>
          }
        />
      }
    >
      <View style={styles.viewfinder} accessibilityLabel={s.scanner.frame}>
        <View style={[styles.frameTag, { backgroundColor: c.surface }]}>
          <Icon name="camera" size={12} />
          <Text variant="caption">{s.scanner.frame}</Text>
        </View>
        <View style={styles.sheet}>
          {[0.8, 0.6, 0.7, 0.5, 0.75, 0.55].map((w, i) => (
            <View key={i} style={[styles.line, { width: `${w * 100}%` }]} />
          ))}
        </View>
      </View>
      <View style={styles.controls}>
        <IconButton icon="image" label={s.scanner.gallery} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.scanner.shutter}
          style={[styles.shutter, { borderColor: c.primary }]}
        >
          <View style={[styles.shutterInner, { backgroundColor: c.primary }]} />
        </Pressable>
        <IconButton icon="zap" label={s.scanner.flash} />
      </View>
      <Text variant="caption" color="textMuted" align="center">
        {s.scanner.hint}
      </Text>
      <View style={styles.chips}>
        <Chip label={s.scanner.pages(scanReading.pages)} tone="primary" icon="file-text" />
        <Chip label={s.scanner.language} icon="globe" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // El visor es siempre oscuro (imagen de cámara), en ambos temas.
  viewfinder: {
    backgroundColor: palettes.dark.surface,
    borderRadius: radius.lg,
    aspectRatio: 0.82,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  frameTag: {
    position: 'absolute',
    top: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  sheet: {
    backgroundColor: palettes.light.surface,
    width: '78%',
    height: '78%',
    borderRadius: 4,
    padding: space.lg,
    gap: space.md,
    transform: [{ rotate: '-2deg' }],
  },
  line: { height: 6, borderRadius: 3, backgroundColor: palettes.light.border },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
});
