import { useLocalSearchParams } from 'expo-router';
import { Banner, Card, Screen, Text, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { useLanguage } from '@/i18n/language';
import {
  LEGAL,
  LEGAL_LABELS,
  LEGAL_UPDATED,
  LEGAL_VERSION,
  hasPlaceholders,
  type LegalDoc,
} from '@/i18n/legal';

/**
 * Pantalla 55 · Términos, privacidad y suscripción (borradores; requieren revisión legal).
 */
export default function Legal() {
  const s = useStrings();
  const language = useLanguage();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: LegalDoc = doc === 'privacy' || doc === 'subscription' ? doc : 'terms';
  const sections = LEGAL[language][key];
  const labels = LEGAL_LABELS[language];
  return (
    <Screen header={<TopBar title={s.legal[key]} />}>
      {hasPlaceholders(sections) ? (
        <Banner tone="warning" icon="alert-triangle" title={s.legal.draft} />
      ) : null}
      <Text variant="small" color="textMuted">
        {`${labels.updated}: ${LEGAL_UPDATED[language]} · ${labels.version} ${LEGAL_VERSION}`}
      </Text>
      {sections.map((section) => (
        <Card key={section.title}>
          <Text variant="subheading" accessibilityRole="header">
            {section.title}
          </Text>
          {section.paragraphs.map((p, i) => (
            <Text key={i} variant="body">
              {p}
            </Text>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
