/** En web, el selector entrega el `File` del navegador con su tamaño exacto. */
export function photoSizeBytes(asset: { uri: string; file?: Blob; fileSize?: number }): number {
  return asset.file?.size ?? asset.fileSize ?? 0;
}
