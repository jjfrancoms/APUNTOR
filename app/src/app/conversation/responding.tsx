import { previewOnly } from '@/components/domain/PreviewOnly';
import { StyleSheet, View } from 'react-native';
import {
  ChatScreen,
  Composer,
  courseCount,
  MascotBubble,
  UserBubble,
} from '@/components/chat/Chat';
import { Chip, Icon, Mascot, Text } from '@/components/ui';
import { chatSample } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { space, useTheme } from '@/theme';

/** Pantalla 24 · Respondiendo: lo propio carga primero; el bloque externo, aparte. */
function Responding() {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <ChatScreen
      subtitle={s.chat.knowsShort(courseCount)}
      composer={<Composer placeholder={s.chat.placeholderShort} busy />}
    >
      <View style={styles.center}>
        <Mascot size={96} mood="curious" />
      </View>
      <UserBubble text={chatSample.question} />
      <MascotBubble
        sources={
          <>
            <Chip label="Cálculo I · Clase 3" tone="primary" icon="file-text" />
            <Chip label={s.chat.externalPending} tone="external" icon="globe" />
          </>
        }
      >
        <View style={styles.row} accessibilityLiveRegion="polite">
          <Icon name="refresh-cw" size={14} color="primary" />
          <Text variant="smallStrong" color="primary">
            {s.chat.searching}
          </Text>
        </View>
        {[0.95, 0.8, 0.6].map((w) => (
          <View
            key={w}
            style={[styles.skeleton, { width: `${w * 100}%`, backgroundColor: c.surfaceAlt }]}
          />
        ))}
      </MascotBubble>
    </ChatScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  skeleton: { height: 8, borderRadius: 4, minWidth: 180 },
});

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(Responding);
