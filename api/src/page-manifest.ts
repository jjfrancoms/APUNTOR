import { z } from 'zod';
import { derivedPrefix } from './storage/file-storage';

/**
 * Lo que el worker guarda en R2 junto al archivo (`usuario/doc/pages.json`): el texto de cada
 * página con sus saltos de línea (el mismo con que se calcularon los offsets de los fragmentos)
 * y, si se pudo dibujar, la imagen de la página tal como se ve en el documento (tablas,
 * fórmulas y gráficos incluidos).
 */
export const pageManifestSchema = z.object({
  version: z.literal(1),
  pages: z.array(
    z.object({
      pageNumber: z.number().int().min(1),
      text: z.string(),
      image: z
        .object({
          key: z.string().min(1),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
        })
        .optional(),
    }),
  ),
});

export type PageManifest = z.infer<typeof pageManifestSchema>;

export const manifestKey = (filePath: string): string => `${derivedPrefix(filePath)}pages.json`;
export const pageImageKey = (filePath: string, pageNumber: number): string =>
  `${derivedPrefix(filePath)}page-${pageNumber}.png`;

export function parsePageManifest(bytes: Uint8Array): PageManifest | null {
  try {
    const result = pageManifestSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Manifiestos recién leídos, por documento: abrir varios temas del mismo documento no vuelve a
 * descargarlo de R2. Un documento sin manifiesto (procesado antes de que existiera) se recuerda
 * poco tiempo, por si se reprocesa.
 */
export function createManifestCache(
  storage: { download(key: string): Promise<Uint8Array> },
  options: { ttlMs?: number; missingTtlMs?: number; maxEntries?: number; now?: () => number } = {},
) {
  const ttl = options.ttlMs ?? 10 * 60_000;
  const missingTtl = options.missingTtlMs ?? 60_000;
  const max = options.maxEntries ?? 50;
  const now = options.now ?? Date.now;
  const entries = new Map<string, { manifest: PageManifest | null; expires: number }>();
  return {
    async get(documentId: string, filePath: string): Promise<PageManifest | null> {
      const hit = entries.get(documentId);
      if (hit && hit.expires > now()) return hit.manifest;
      let manifest: PageManifest | null = null;
      try {
        manifest = parsePageManifest(await storage.download(manifestKey(filePath)));
      } catch {
        manifest = null;
      }
      entries.delete(documentId);
      entries.set(documentId, { manifest, expires: now() + (manifest ? ttl : missingTtl) });
      while (entries.size > max) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return manifest;
    },
    forget(documentId: string): void {
      entries.delete(documentId);
    },
  };
}
