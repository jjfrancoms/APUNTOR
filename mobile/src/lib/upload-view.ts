import type { ChipTone } from '@/components/ui';
import type { UploadJob } from '@/store/store';

export function jobTone(job: UploadJob): ChipTone {
  if (job.status === 'failed') return 'danger';
  if (job.status === 'review' || job.status === 'done') return 'primary';
  if (job.status === 'processing') return 'warning';
  return 'neutral';
}
