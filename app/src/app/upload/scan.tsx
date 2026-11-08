import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Image, Linking, Platform, StyleSheet, View } from 'react-native';
import { Banner, Chip, EmptyState, Icon, IconButton, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { MAX_SCAN_PAGES } from '@/lib/scan';
import {
  cameraAllowed,
  pickPhotos,
  recoverPendingPhotos,
  takePhoto,
  type ScanCapture,
} from '@/lib/scan-picker';
import {
  addScanPages,
  clearScan,
  getScanSession,
  setCameraDenied,
  useScanSession,
} from '@/lib/scan-session';
import { palettes, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/**
 * Pantalla 28 · Escanear apunte (con 47, cámara denegada). La foto se toma con la cámara del
 * sistema; el visor muestra cómo encuadrar la hoja y, después, la última foto.
 */
export default function Scan() {
  const s = useStrings();
  const { c } = useTheme();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const { pages, cameraDenied } = useScanSession();
  const [notice, setNotice] = useState<'failed' | 'limit' | null>(null);
  const denied = demo === 'denied' || cameraDenied;
  const room = MAX_SCAN_PAGES - pages.length;
  const last = pages.at(-1);

  useEffect(() => {
    void recoverPendingPhotos().then(addScanPages);
    // Las fotos solo viven mientras se escanea: al salir no quedan en memoria.
    return clearScan;
  }, []);

  // Al volver de Ajustes con el permiso concedido, se recupera el visor.
  useEffect(() => {
    if (!cameraDenied) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void cameraAllowed().then((allowed) => allowed && setCameraDenied(false));
    });
    return () => sub.remove();
  }, [cameraDenied]);

  const apply = (result: ScanCapture) => {
    if (result.status === 'canceled') return;
    if (result.status === 'denied') {
      setCameraDenied(true);
      return;
    }
    if (result.status === 'failed') {
      setNotice('failed');
      return;
    }
    setCameraDenied(false);
    const added = addScanPages(result.pages);
    setNotice(added < result.pages.length ? 'limit' : null);
  };

  const shoot = () => {
    if (getScanSession().pages.length >= MAX_SCAN_PAGES) {
      setNotice('limit');
      return;
    }
    void takePhoto().then(apply);
  };
  const fromGallery = () => {
    const free = MAX_SCAN_PAGES - getScanSession().pages.length;
    if (free <= 0) {
      setNotice('limit');
      return;
    }
    void pickPhotos(free).then(apply);
  };

  // Pantalla 47 · Cámara denegada.
  if (denied) {
    return (
      <Screen header={<TopBar icon="x" title={s.scanner.header} />}>
        <EmptyState
          mood="worried"
          title={s.empty.cameraTitle}
          body={s.scanner.deniedBody}
          // En web no hay ajustes del teléfono que abrir.
          {...(Platform.OS === 'web'
            ? {}
            : {
                primary: {
                  label: s.empty.openSettings,
                  onPress: () => void Linking.openSettings(),
                },
              })}
          secondary={{ label: s.empty.pickGallery, onPress: fromGallery }}
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
          subtitle={s.scanner.page(Math.min(pages.length + 1, MAX_SCAN_PAGES))}
          right={
            pages.length > 0 ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={s.scanner.done}
                onPress={() => router.push('/upload/scan-review')}
                hitSlop={10}
              >
                <Chip label={s.scanner.done} tone="primary" />
              </Tap>
            ) : undefined
          }
        />
      }
    >
      {notice === 'failed' ? <Banner tone="danger" title={s.scanner.failed} /> : null}
      {notice === 'limit' ? (
        <Banner tone="warning" title={s.scanner.limit(MAX_SCAN_PAGES)} />
      ) : null}
      {last ? (
        <Image
          source={{ uri: last.uri }}
          accessibilityLabel={s.scanner.lastPhoto}
          resizeMode="contain"
          style={styles.viewfinder}
        />
      ) : (
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
      )}
      <View style={styles.controls}>
        <IconButton icon="image" label={s.scanner.gallery} onPress={fromGallery} />
        <Tap
          accessibilityRole="button"
          accessibilityLabel={s.scanner.shutter}
          accessibilityState={{ disabled: room <= 0 }}
          onPress={shoot}
          style={[styles.shutter, { borderColor: c.primary, opacity: room <= 0 ? 0.5 : 1 }]}
        >
          <View style={[styles.shutterInner, { backgroundColor: c.primary }]} />
        </Tap>
        {/* Ocupa el lugar del tercer control para que el disparador quede centrado. */}
        <View style={styles.balance} />
      </View>
      <Text variant="caption" color="textMuted" align="center">
        {s.scanner.hint}
      </Text>
      {pages.length > 0 ? (
        <View style={styles.chips}>
          <Chip label={s.scanner.pages(pages.length)} tone="primary" icon="file-text" />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // El visor es siempre oscuro (imagen de cámara), en ambos temas.
  viewfinder: {
    backgroundColor: palettes.dark.surface,
    borderRadius: radius.lg,
    aspectRatio: 0.82,
    width: '100%',
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
  balance: { width: 44, height: 44 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
});
