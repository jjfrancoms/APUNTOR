import { Chip } from '@/components/ui';
import { Tap } from '@/components/ui/Tap';
import { useStrings } from '@/i18n/es';
import type { ApiStudyCitation } from '@/lib/api';
import { openSourcePage } from '@/lib/source-page';

/** Cita de un elemento de estudio: al tocarla se abre la página del original. */
export function CitationChip({ citation }: { citation: ApiStudyCitation }) {
  const s = useStrings();
  return (
    <Tap
      accessibilityRole="link"
      accessibilityLabel={s.study.openPage(citation.pageNumber)}
      onPress={() => void openSourcePage(citation.documentId, citation.pageNumber)}
    >
      <Chip label={s.study.source(citation.pageNumber)} tone="primary" icon="file-text" />
    </Tap>
  );
}
