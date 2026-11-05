import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const UPLOAD_URL_TTL_SECONDS = 15 * 60;

export interface FileStorage {
  download(key: string): Promise<Uint8Array>;
  /** Tamaño real del objeto, o null si todavía no se subió. */
  sizeOf(key: string): Promise<number | null>;
  delete(key: string): Promise<void>;
  createUploadUrl(key: string, contentType: string, sizeBytes: number): Promise<string>;
}

/** Rechaza claves que intenten salir de la carpeta del usuario. */
export function assertSafeKey(key: string): void {
  const segments = key.split('/');
  if (segments.some((s) => s.length === 0 || s === '.' || s === '..')) {
    throw new Error('Ruta de archivo inválida');
  }
}

function hasStatus(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) return false;
  const metadata = error.$metadata;
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'httpStatusCode' in metadata &&
    metadata.httpStatusCode === status
  );
}

/** Cloudflare R2 por su API compatible con S3. Las credenciales solo viven en el servidor. */
export class R2FileStorage implements FileStorage {
  private readonly client: S3Client;

  constructor(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async download(key: string): Promise<Uint8Array> {
    assertSafeKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('R2 devolvió un objeto sin contenido');
    return response.Body.transformToByteArray();
  }

  async sizeOf(key: string): Promise<number | null> {
    assertSafeKey(key);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return response.ContentLength ?? null;
    } catch (error) {
      if (hasStatus(error, 404)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async createUploadUrl(key: string, contentType: string, sizeBytes: number): Promise<string> {
    assertSafeKey(key);
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: sizeBytes,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
  }
}
