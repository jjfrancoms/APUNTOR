import { Chip } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import type { ApiStudyCitation } from '@/lib/api';
import { openSourcePage } from '@/lib/source-page';

/**
 * Cita de un elemento de estudio (referencia: Citation de redrob-labs): píldora compacta
 * “pág. N” con borde y flecha, que se lee como tocable. Al tocarla se abre la página del original.
 */
export function CitationChip({ citation }: { citation: ApiStudyCitation }) {
  const s = useStrings();
  return (
    <Chip
      label={s.study.source(citation.pageNumber)}
      tone="primary"
      icon="file-text"
      accessibilityRole="link"
      accessibilityLabel={s.study.openPage(citation.pageNumber)}
      onPress={() => void openSourcePage(citation.documentId, citation.pageNumber)}
    />
  );
}
