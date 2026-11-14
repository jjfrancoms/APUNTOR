import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { isUnclear, MAX_SCAN_PAGES, scanUploadAssets, type ScanPage } from '@/lib/scan';
import { takePhoto } from '@/lib/scan-picker';
import {
  clearScan,
  removeScanPage,
  replaceScanPage,
  setCameraDenied,
  useScanSession,
} from '@/lib/scan-session';
import { enqueueUploads, fileFromPicker } from '@/store/store';
import { radius, space, useTheme, useWide } from '@/theme';

/** Página de ejemplo para ver el aviso con `?demo=unclear` (sin foto real). */
const DEMO_PAGE: ScanPage = {
  id: 'demo',
  uri: '',
  width: 640,
  height: 480,
  sizeBytes: 1,
  extension: 'jpg',
  capturedAt: 0,
};

/**
 * Pantalla 29 · Revisar fotos antes de subirlas. Avisa "lectura poco clara" solo si la foto
 * tiene poca resolución; lo que de verdad se leyó se conoce después, al procesarla.
 */
export default function ScanReview() {
  const s = useStrings();
  const { c } = useTheme();
  const wide = useWide();
  const r = s.scanReview;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const session = useScanSession();
  const [failed, setFailed] = useState(false);
  const pages = demo === 'unclear' ? [DEMO_PAGE] : session.pages;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/upload/scan'));

  const retake = (page: ScanPage) =>
    void takePhoto().then((result) => {
      setFailed(result.status === 'failed');
      if (result.status === 'denied') {
        setCameraDenied(true);
        back();
        return;
      }
      if (result.status !== 'ok') return;
      const [next] = result.pages;
      if (next) replaceScanPage(page.id, next);
    });

  const upload = () => {
    enqueueUploads(scanUploadAssets(pages, s.scanner.fileBase).map(fileFromPicker));
    clearScan();
    router.replace('/upload/progress');
  };

  if (pages.length === 0) {
    return (
      <Screen header={<TopBar title={r.header} />}>
        <EmptyState
          title={r.emptyTitle}
          body={r.emptyBody}
          primary={{ label: r.scan, onPress: back }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      wide
      header={<TopBar title={r.header} />}
      footer={
        <>
          <Button label={r.upload(pages.length)} onPress={upload} />
          {pages.length < MAX_SCAN_PAGES ? (
            <Button label={r.addMore} variant="ghost" icon="camera" onPress={back} />
          ) : null}
        </>
      }
    >
      {failed ? <Banner tone="danger" title={s.scanner.failed} /> : null}
      {pages.some(isUnclear) ? (
        <Banner tone="warning" title={r.unclearTitle} body={r.unclearBody} />
      ) : null}
      <View style={[styles.grid, wide && styles.gridWide]}>
        {pages.map((page, i) => (
          <Card key={page.id} style={wide && styles.cell}>
            <View style={styles.row}>
              {page.uri ? (
                <Image
                  source={{ uri: page.uri }}
                  accessibilityLabel={r.thumb(i + 1)}
                  resizeMode="cover"
                  style={[styles.thumb, { backgroundColor: c.surfaceAlt }]}
                />
              ) : (
                <View style={[styles.thumb, styles.empty, { backgroundColor: c.surfaceAlt }]}>
                  <Icon name="image" size={20} color="textMuted" />
                </View>
              )}
              <View style={styles.body}>
                <Text variant="smallStrong">{r.page(i + 1)}</Text>
                {isUnclear(page) ? (
                  <View style={styles.chip}>
                    <Chip label={r.unclearChip} tone="warning" icon="alert-triangle" />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <TextLink label={r.retake} onPress={() => retake(page)} />
                  <TextLink
                    label={r.remove}
                    color="danger"
                    onPress={() => removeScanPage(page.id)}
                  />
                </View>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '48%', flexGrow: 1 },
  row: { flexDirection: 'row', gap: space.md },
  thumb: { width: 72, height: 96, borderRadius: radius.sm },
  empty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: space.xs },
  chip: { flexDirection: 'row' },
  actions: { flexDirection: 'row', gap: space.lg },
});
