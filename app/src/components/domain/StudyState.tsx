import { StyleSheet, View } from 'react-native';
import { EmptyState, Mascot, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import type { StudyErrorCode } from '@/lib/study';
import { space } from '@/theme';

/** Estado de carga de las pantallas de estudio. */
export function StudyLoading({ title, hint }: { title?: string; hint?: string }) {
  const s = useStrings();
  return (
    <View style={styles.loading} accessibilityRole="progressbar">
      <Mascot mood="curious" size={96} />
      <Text variant="bodyStrong" align="center">
        {title ?? s.study.loading}
      </Text>
      <Text variant="small" color="textMuted" align="center">
        {hint ?? s.study.loadingHint}
      </Text>
    </View>
  );
}

/** Estado de error o sin conexión de las pantallas de estudio. */
export function StudyError({ code, onRetry }: { code: StudyErrorCode; onRetry?: () => void }) {
  const s = useStrings();
  const offline = code === 'NET';
  return (
    <EmptyState
      mood="sleepy"
      title={offline ? s.study.offlineTitle : s.study.errorTitle}
      body={offline ? s.study.offlineBody : s.study.errors[code]}
      primary={onRetry ? { label: s.study.retry, onPress: onRetry } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
});
