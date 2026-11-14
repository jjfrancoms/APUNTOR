import { StyleSheet, View } from 'react-native';
import { Chip, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { openSourcePage } from '@/lib/source-page';
import type { AnswerClaim } from '@/store/seed';
import { space } from '@/theme';

/**
 * Respuesta de Illari con estructura: cada idea con su término y su notación (si el fragmento
 * citado los trae), la explicación y su página. Tocar la página abre el original para
 * comprobarla. Las ideas siguen el orden de los apuntes.
 */
export function AnswerClaims({ claims }: { claims: readonly AnswerClaim[] }) {
  const s = useStrings();
  return (
    <View style={styles.list}>
      {claims.map((claim, i) => (
        <View key={i} style={styles.claim}>
          {claim.label || claim.formula ? (
            <View style={styles.head}>
              {claim.label ? (
                <Text variant="smallStrong" selectable>
                  {claim.label}
                </Text>
              ) : null}
              {claim.formula ? (
                <Text variant="smallStrong" color="primary" selectable>
                  {claim.formula}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text variant="small" selectable>
            {claim.text}
          </Text>
          <View style={styles.pages}>
            {claim.pages.map((p) => (
              <Chip
                key={`${p.documentId}-${p.page}`}
                label={s.chat.ownSource(p.page)}
                tone="primary"
                icon="file-text"
                accessibilityRole="link"
                accessibilityLabel={s.chat.checkPage(p.page)}
                onPress={() => void openSourcePage(p.documentId, p.page)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  claim: { gap: space.xs },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  pages: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
