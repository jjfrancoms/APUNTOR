import { beforeEach, describe, expect, it } from 'vitest';
import {
  isUnclear,
  MAX_SCAN_PAGES,
  photoExtension,
  scanFileName,
  scanUploadAssets,
  type ScanPage,
} from '../src/lib/scan';
import {
  addScanPages,
  clearScan,
  getScanSession,
  removeScanPage,
  replaceScanPage,
  setCameraDenied,
} from '../src/lib/scan-session';

function page(id: string, patch: Partial<ScanPage> = {}): ScanPage {
  return {
    id,
    uri: `file:///cache/${id}.jpg`,
    width: 1500,
    height: 2000,
    sizeBytes: 1000,
    extension: 'jpg',
    capturedAt: new Date(2026, 10, 8, 15, 30, 12).getTime(),
    ...patch,
  };
}

describe('lectura poco clara', () => {
  it('avisa solo cuando el lado corto es pequeño', () => {
    expect(isUnclear({ width: 640, height: 2000 })).toBe(true);
    expect(isUnclear({ width: 2000, height: 640 })).toBe(true);
    expect(isUnclear({ width: 800, height: 1000 })).toBe(false);
  });

  it('sin dimensiones conocidas no acusa a la foto', () => {
    expect(isUnclear({ width: 0, height: 0 })).toBe(false);
  });
});

describe('extensión de la foto', () => {
  it('confía primero en el tipo real', () => {
    expect(photoExtension({ mimeType: 'image/jpeg', uri: 'file:///a.heic' })).toBe('jpg');
    expect(photoExtension({ mimeType: 'image/heif', uri: 'file:///a' })).toBe('heic');
  });

  it('no disfraza de JPEG un formato no admitido', () => {
    expect(photoExtension({ mimeType: 'image/webp', uri: 'blob:x' })).toBe('webp');
    expect(photoExtension({ fileName: 'foto.TIFF', uri: 'blob:x' })).toBe('tiff');
  });

  it('usa la ruta si no hay tipo, y JPEG como último recurso', () => {
    expect(photoExtension({ uri: 'file:///cache/foto.PNG?x=1' })).toBe('png');
    expect(photoExtension({ uri: 'file:///cache/foto.jpeg' })).toBe('jpg');
    expect(photoExtension({ uri: 'data:image/png;base64,AAAA' })).toBe('jpg');
  });
});

describe('archivos a subir', () => {
  it('el nombre lleva fecha, hora y página', () => {
    const at = new Date(2026, 10, 8, 15, 30, 12).getTime();
    expect(scanFileName('Apunte', at, 2, 'jpg')).toBe('Apunte 2026-11-08 15.30.12 p2.jpg');
  });

  it('dos fotos del mismo segundo no se descartan como repetidas', () => {
    const [a, b] = scanUploadAssets([page('a'), page('b')], 'Apunte');
    expect(a?.name).not.toBe(b?.name);
  });

  it('conserva el tamaño exacto, que la API compara con lo subido', () => {
    const [asset] = scanUploadAssets([page('a', { sizeBytes: 123456 })], 'Apunte');
    expect(asset?.size).toBe(123456);
  });
});

describe('sesión de escaneo', () => {
  beforeEach(clearScan);

  it('no pasa del tope e informa cuántas entraron', () => {
    const many = Array.from({ length: MAX_SCAN_PAGES + 3 }, (_, i) => page(`p${i}`));
    expect(addScanPages(many)).toBe(MAX_SCAN_PAGES);
    expect(addScanPages([page('otra')])).toBe(0);
    expect(getScanSession().pages).toHaveLength(MAX_SCAN_PAGES);
  });

  it('repetir una foto conserva su lugar', () => {
    addScanPages([page('a'), page('b'), page('c')]);
    replaceScanPage('b', page('nueva'));
    expect(getScanSession().pages.map((p) => p.id)).toEqual(['a', 'nueva', 'c']);
  });

  it('quitar y limpiar', () => {
    addScanPages([page('a'), page('b')]);
    setCameraDenied(true);
    removeScanPage('a');
    expect(getScanSession().pages.map((p) => p.id)).toEqual(['b']);
    clearScan();
    expect(getScanSession()).toEqual({ pages: [], cameraDenied: false });
  });
});
