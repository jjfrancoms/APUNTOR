import { manifestKey, pageImageKey, type PageManifest } from '../../../api/src/page-manifest';
import type { FileStorage } from '../../../api/src/storage/file-storage';
import { detectFormat } from './extractors';
import { normalizePageText, type ParsedDocument } from './pdf-parser';

/** Ancho de las imágenes de página: nítidas en pantallas grandes, ~100 KB por página. */
export const PAGE_IMAGE_WIDTH = 1240;
/** Un documento enorme no debe llenar el almacenamiento con imágenes. */
export const MAX_RENDERED_PAGES = 300;

export interface RenderedPage {
  pageNumber: number;
  png: Uint8Array;
  width: number;
  height: number;
}

/** Dibuja las páginas de un archivo, una a una (no las guarda todas en memoria). */
export interface PageRenderer {
  render(data: Uint8Array, onPage: (page: RenderedPage) => Promise<void>): Promise<void>;
}

/** Páginas de PDF con pdf.js + @napi-rs/canvas. Otros formatos no se dibujan (Word y PowerPoint
 * necesitarían LibreOffice): su contenido se muestra como texto. */
export class PdfPageRenderer implements PageRenderer {
  async render(data: Uint8Array, onPage: (page: RenderedPage) => Promise<void>): Promise<void> {
    if ((await detectFormat(data)).kind !== 'pdf') return;
    const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
    const pdf = await getDocumentProxy(data.slice());
    try {
      const total = Math.min(pdf.numPages, MAX_RENDERED_PAGES);
      for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
        const viewport = (await pdf.getPage(pageNumber)).getViewport({ scale: 1 });
        const width = PAGE_IMAGE_WIDTH;
        const height = Math.max(1, Math.round((viewport.height / viewport.width) * width));
        const png = await renderPageAsImage(pdf, pageNumber, {
          canvasImport: () => import('@napi-rs/canvas'),
          width,
          height,
        });
        await onPage({ pageNumber, png: new Uint8Array(png), width, height });
      }
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
}

/**
 * Guarda el texto por página y las imágenes de página. No es imprescindible para responder
 * preguntas: si falla, el documento queda igual de útil (el contenido de un tema se arma con los
 * fragmentos). Por eso nunca lanza; devuelve si pudo guardar el manifiesto.
 */
export async function storePageArtifacts(
  storage: FileStorage,
  filePath: string,
  data: Uint8Array,
  parsed: ParsedDocument,
  renderer: PageRenderer | undefined,
): Promise<boolean> {
  try {
    const images = new Map<number, { key: string; width: number; height: number }>();
    if (renderer) {
      try {
        await renderer.render(data, async (page) => {
          const key = pageImageKey(filePath, page.pageNumber);
          await storage.upload(key, page.png, 'image/png');
          images.set(page.pageNumber, { key, width: page.width, height: page.height });
        });
      } catch (error) {
        console.error('[ingesta] no se pudieron dibujar las páginas', toMessage(error));
      }
    }
    const manifest: PageManifest = {
      version: 1,
      pages: parsed.pages.map((page) => {
        const image = images.get(page.pageNumber);
        return {
          pageNumber: page.pageNumber,
          text: normalizePageText(page.text),
          ...(image ? { image } : {}),
        };
      }),
    };
    await storage.upload(
      manifestKey(filePath),
      new TextEncoder().encode(JSON.stringify(manifest)),
      'application/json',
    );
    return true;
  } catch (error) {
    console.error('[ingesta] no se guardó el texto por página', toMessage(error));
    return false;
  }
}

function toMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}
