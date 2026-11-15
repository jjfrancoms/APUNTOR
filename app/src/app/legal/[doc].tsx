import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner, Screen, Text, TopBar } from '@/components/ui';
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
import { space, useTheme } from '@/theme';

/**
 * Pantalla 55 · Términos, privacidad y suscripción (borradores; requieren revisión legal).
 * Texto largo: una columna de lectura alineada a la izquierda (≈ 70 caracteres) y secciones
 * separadas por una línea fina, sin tarjetas.
 */
export default function Legal() {
  const s = useStrings();
  const { c } = useTheme();
  const language = useLanguage();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: LegalDoc = doc === 'privacy' || doc === 'subscription' ? doc : 'terms';
  const sections = LEGAL[language][key];
  const labels = LEGAL_LABELS[language];
  return (
    <Screen header={<TopBar title={s.legal[key]} />}>
      <View style={styles.column}>
        {hasPlaceholders(sections) ? (
          <Banner tone="warning" icon="alert-triangle" title={s.legal.draft} />
        ) : null}
        <Text variant="small" color="textMuted">
          {`${labels.updated}: ${LEGAL_UPDATED[language]} · ${labels.version} ${LEGAL_VERSION}`}
        </Text>
        {sections.map((section, i) => (
          <View
            key={section.title}
            style={[
              styles.section,
              i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <Text variant="heading" accessibilityRole="header">
              {section.title}
            </Text>
            {section.paragraphs.map((p, j) => (
              <Text key={j} variant="body">
                {p}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Ancho de lectura: unos 70 caracteres por línea.
  column: { maxWidth: 640, gap: space.lg },
  section: { gap: space.sm, paddingTop: space.lg },
});
