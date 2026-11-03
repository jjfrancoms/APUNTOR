import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  Chip,
  Icon,
  IconButton,
  Mascot,
  Screen,
  Text,
  TopBar,
  type MascotMood,
} from '@/components/ui';
import { courses } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { fonts, layout, radius, space, useTheme } from '@/theme';

/** Burbuja del estudiante (derecha, verde). */
export function UserBubble({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.user, { backgroundColor: c.primary }]}>
      <Text variant="small" color="onPrimary">
        {text}
      </Text>
    </View>
  );
}

/** Respuesta de la mascota con sus fuentes: propio en verde, externo en violeta. */
export function MascotBubble({ children, sources }: { children: ReactNode; sources?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.mascot, { backgroundColor: c.surface, borderColor: c.border }]}>
      {children}
      {sources ? <View style={styles.sources}>{sources}</View> : null}
    </View>
  );
}

export function MascotStage({ label, mood = 'happy' }: { label: string; mood?: MascotMood }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stage, { backgroundColor: c.primarySoft }]}>
      <View style={[styles.stageTag, { backgroundColor: c.surface }]}>
        <Icon name="box" size={11} color="primary" />
        <Text variant="caption">{label}</Text>
      </View>
      <Mascot size={92} mood={mood} />
    </View>
  );
}

export function Composer({
  placeholder,
  busy = false,
  disabled = false,
}: {
  placeholder: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <View style={styles.composer}>
      <View style={[styles.input, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          editable={!busy && !disabled}
          style={[styles.field, { color: c.text }]}
        />
        <Icon name="mic" size={18} color="textMuted" />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? s.chat.stop : s.chat.send}
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[
          styles.send,
          { backgroundColor: busy ? c.textMuted : c.primary, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Icon name={busy ? 'square' : 'send'} size={18} color="onPrimary" />
      </Pressable>
    </View>
  );
}

/** Estructura común: barra superior, mensajes desplazables y campo fijo al pie. */
export function ChatScreen({
  subtitle,
  children,
  composer,
  withHistory = true,
}: {
  subtitle: string;
  children: ReactNode;
  composer: ReactNode;
  withHistory?: boolean;
}) {
  const s = useStrings();
  return (
    <Screen
      edges={['top', 'left', 'right', 'bottom']}
      header={
        <TopBar
          title={s.chat.title}
          subtitle={subtitle}
          right={
            withHistory ? (
              <IconButton
                icon="clock"
                label={s.chat.history}
                onPress={() => router.navigate('/chat')}
              />
            ) : undefined
          }
        />
      }
      footer={composer}
    >
      {children}
    </Screen>
  );
}

export const courseCount = courses.length;

export function SourceChips({ page, external }: { page: number; external: string }) {
  const s = useStrings();
  return (
    <>
      <Chip label={s.chat.ownSource(page)} tone="primary" icon="file-text" />
      <Chip
        label={external}
        tone={external === s.chat.externalOffline ? 'neutral' : 'external'}
        icon="globe"
      />
    </>
  );
}

const styles = StyleSheet.create({
  user: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
  },
  mascot: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderWidth: 1,
    padding: space.lg,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    gap: space.sm,
  },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  stage: {
    borderRadius: radius.xl,
    alignItems: 'center',
    paddingVertical: space.lg,
    gap: space.xs,
  },
  stageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: layout.minTouchTarget + 4,
  },
  field: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    paddingVertical: space.sm,
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
  send: {
    width: layout.minTouchTarget + 4,
    height: layout.minTouchTarget + 4,
    borderRadius: (layout.minTouchTarget + 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
