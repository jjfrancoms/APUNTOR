import { describe, expect, it } from 'vitest';
import { createManifestCache, manifestKey, parsePageManifest } from '../../api/src/page-manifest';
import type { FileStorage } from '../../api/src/storage/file-storage';
import { storePageArtifacts, type PageRenderer } from '../../worker/src/ingestion/page-artifacts';

function memoryStorage() {
  const files = new Map<string, { data: Uint8Array; type: string }>();
  const storage: FileStorage = {
    download(key) {
      const file = files.get(key);
      return file ? Promise.resolve(file.data) : Promise.reject(new Error('NoSuchKey'));
    },
    sizeOf: (key) => Promise.resolve(files.get(key)?.data.length ?? null),
    delete(key) {
      files.delete(key);
      return Promise.resolve();
    },
    createUploadUrl: () => Promise.resolve(''),
    upload(key, data, type) {
      files.set(key, { data, type });
      return Promise.resolve();
    },
    createDownloadUrl: (key) => Promise.resolve(key),
    deletePrefix: () => Promise.resolve(),
  };
  return { files, storage };
}

const parsed = {
  totalPages: 2,
  pages: [
    { pageNumber: 1, text: 'Tema  1\n\n\n\nTexto' },
    { pageNumber: 2, text: 'Tabla\n1 0' },
  ],
};

const renderer: PageRenderer = {
  async render(_data, onPage) {
    for (const pageNumber of [1, 2]) {
      await onPage({ pageNumber, png: new Uint8Array([pageNumber]), width: 10, height: 14 });
    }
  },
};

describe('texto e imágenes por página', () => {
  it('guarda cada página como imagen y el texto normalizado en el manifiesto', async () => {
    const { files, storage } = memoryStorage();
    expect(
      await storePageArtifacts(storage, 'u1/doc.pdf', new Uint8Array(), parsed, renderer),
    ).toBe(true);
    expect(files.get('u1/doc/page-2.png')?.type).toBe('image/png');
    const manifest = parsePageManifest(
      files.get(manifestKey('u1/doc.pdf'))?.data ?? new Uint8Array(),
    );
    expect(manifest?.pages).toEqual([
      {
        pageNumber: 1,
        text: 'Tema 1\n\nTexto',
        image: { key: 'u1/doc/page-1.png', width: 10, height: 14 },
      },
      {
        pageNumber: 2,
        text: 'Tabla\n1 0',
        image: { key: 'u1/doc/page-2.png', width: 10, height: 14 },
      },
    ]);
  });

  it('si no se pueden dibujar las páginas, guarda igual el texto (no falla la ingesta)', async () => {
    const { files, storage } = memoryStorage();
    const broken: PageRenderer = { render: () => Promise.reject(new Error('sin canvas')) };
    expect(await storePageArtifacts(storage, 'u1/doc.pdf', new Uint8Array(), parsed, broken)).toBe(
      true,
    );
    const manifest = parsePageManifest(files.get('u1/doc/pages.json')?.data ?? new Uint8Array());
    expect(manifest?.pages.every((p) => p.image === undefined)).toBe(true);
  });

  it('un manifiesto inválido se ignora', () => {
    expect(parsePageManifest(new TextEncoder().encode('{"version":2}'))).toBeNull();
    expect(parsePageManifest(new TextEncoder().encode('no es json'))).toBeNull();
  });

  it('la caché evita descargar el manifiesto en cada tema', async () => {
    const { storage } = memoryStorage();
    await storePageArtifacts(storage, 'u1/doc.pdf', new Uint8Array(), parsed, undefined);
    let downloads = 0;
    const cache = createManifestCache({
      download: (key) => {
        downloads += 1;
        return storage.download(key);
      },
    });
    await cache.get('d1', 'u1/doc.pdf');
    expect((await cache.get('d1', 'u1/doc.pdf'))?.pages).toHaveLength(2);
    expect(downloads).toBe(1);
  });
});
