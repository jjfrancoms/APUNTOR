/** Abstracción mínima de almacenamiento de archivos originales. */
export interface FileStorage {
  download(filePath: string): Promise<Uint8Array>;
}

/** Codifica cada segmento y rechaza rutas que intenten salir del bucket. */
export function encodeStoragePath(filePath: string): string {
  const segments = filePath.split('/').filter((s) => s.length > 0);
  if (segments.length === 0 || segments.some((s) => s === '.' || s === '..')) {
    throw new Error('Ruta de archivo inválida');
  }
  return segments.map((s) => encodeURIComponent(s)).join('/');
}

/**
 * Descarga desde Supabase Storage con la service role key. Solo para uso en
 * servidor/worker: nunca debe importarse desde componentes de cliente.
 */
export class SupabaseFileStorage implements FileStorage {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
  ) {}

  async download(filePath: string): Promise<Uint8Array> {
    const base = this.supabaseUrl.replace(/\/+$/u, '');
    const url = `${base}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encodeStoragePath(filePath)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.serviceRoleKey}`, apikey: this.serviceRoleKey },
    });
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo (HTTP ${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
