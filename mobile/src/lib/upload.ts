import type { ChipTone } from '@/components/ui';
import type { UploadStatus } from '@/data/mock';

export const STATUS_TONE: Record<UploadStatus, ChipTone> = {
  ready: 'primary',
  analyzing: 'warning',
  queued: 'neutral',
  processing: 'warning',
  uploading: 'neutral',
};

/** Fracción de archivos listos (0–1). */
export function readyRatio(items: readonly { status: UploadStatus }[]): number {
  if (items.length === 0) return 0;
  return items.filter((i) => i.status === 'ready').length / items.length;
}
