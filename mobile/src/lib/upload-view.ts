import type { ChipTone } from '@/components/ui';
import type { ErrorCode, Strings } from '@/i18n/es';
import type { UploadJob } from '@/store/store';

export function jobTone(job: UploadJob): ChipTone {
  if (job.status === 'failed') return 'danger';
  if (job.status === 'review' || job.status === 'done') return 'primary';
  if (job.status === 'processing') return 'warning';
  return 'neutral';
}

/** Motivo corto de un archivo rechazado, para la fila (el detalle completo está en la pantalla 18). */
export function failureTitle(code: ErrorCode, s: Strings): string {
  switch (code) {
    case 'UP_SIZE':
      return s.uploadProblems.sizeTitle;
    case 'UP_LANGUAGE':
      return s.language.title;
    case 'UP_NETWORK':
      return s.uploadProblems.networkTitle;
    case 'UP_QUOTA':
      return s.uploadProblems.quotaTitle;
    default:
      return s.uploadProblems.formatTitle;
  }
}
