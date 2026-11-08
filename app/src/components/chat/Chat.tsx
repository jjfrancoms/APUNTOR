import { router } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
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
import { useLanguage } from '@/i18n/language';
import { useDictation } from '@/lib/dictation';
import { fonts, layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

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
    <View
      // Los lectores de pantalla anuncian la respuesta cuando llega.
      accessibilityLiveRegion="polite"
      style={[styles.mascot, { backgroundColor: c.surface, borderColor: c.border }]}
    >
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
  sendBlocked = false,
  value,
  onChangeText,
  onSend,
  onStop,
  hint,
}: {
  placeholder: string;
  /** Hay una respuesta en curso: el botón de enviar pasa a ser "Detener" (llama a `onStop`). */
  busy?: boolean;
  disabled?: boolean;
  /** Impide enviar pero deja seguir escribiendo (sin conexión: el borrador no se pierde). */
  sendBlocked?: boolean;
  value?: string;
  onChangeText?: (v: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  /** Aviso pequeño sobre el campo (p. ej. que el borrador se enviará al terminar). */
  hint?: string | null;
}) {
  const s = useStrings();
  const { c } = useTheme();
  const canSend =
    !busy && !disabled && !sendBlocked && (value === undefined || value.trim().length > 0);
  const [focused, setFocused] = useState(false);
  const [keyboardHint, setKeyboardHint] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const language = useLanguage();
  const dictation = useDictation({
    language,
    value: value ?? '',
    onChange: (text) => onChangeText?.(text),
  });
  const onMic = () => {
    if (dictation.support === 'web') {
      if (dictation.listening) dictation.stop();
      else dictation.start();
      return;
    }
    // Teléfono: el dictado lo da el teclado del sistema.
    setKeyboardHint(true);
    input.current?.focus();
  };
  // Mientras responde se puede seguir escribiendo; solo no se envía (Enter conserva el borrador).
  const stopEnabled = busy && !disabled && onStop !== undefined;
  const notice = dictation.listening
    ? s.chat.micListening
    : dictation.error === 'denied'
      ? s.chat.micDenied
      : dictation.error === 'no-speech'
        ? s.chat.micNoSpeech
        : dictation.error === 'failed'
          ? s.chat.micFailed
          : dictation.support === 'none' && keyboardHint
            ? s.chat.micUnsupported
            : keyboardHint
              ? s.chat.micKeyboard
              : null;
  return (
    <View style={styles.composerWrap}>
      {notice ? (
        <Text
          variant="caption"
          color={dictation.error ? 'danger' : 'textMuted'}
          accessibilityLiveRegion="polite"
        >
          {notice}
        </Text>
      ) : null}
      {hint && !notice ? (
        <Text variant="caption" color="textMuted" accessibilityLiveRegion="polite">
          {hint}
        </Text>
      ) : null}
      <View style={styles.composer}>
        <View
          style={[
            styles.input,
            { backgroundColor: c.surface, borderColor: focused ? c.primary : c.border },
          ]}
        >
          <TextInput
            ref={input}
            accessibilityLabel={placeholder}
            placeholder={placeholder}
            placeholderTextColor={c.textMuted}
            editable={!disabled}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={() => {
              if (canSend) onSend?.();
            }}
            // Con una respuesta en curso, Enter no envía ni borra lo escrito.
            submitBehavior={busy ? 'submit' : 'blurAndSubmit'}
            returnKeyType="send"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.field, { color: c.text }]}
          />
          {dictation.support === 'none' && Platform.OS === 'web' ? null : (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={dictation.listening ? s.chat.micStop : s.chat.mic}
              accessibilityState={{ selected: dictation.listening, disabled }}
              disabled={disabled}
              onPress={onMic}
              hitSlop={8}
              style={[styles.mic, dictation.listening && { backgroundColor: c.primarySoft }]}
            >
              <Icon
                name={dictation.listening ? 'mic-off' : 'mic'}
                size={18}
                color={dictation.listening ? 'primary' : 'textMuted'}
              />
            </Tap>
          )}
        </View>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={busy ? s.chat.stop : s.chat.send}
          accessibilityState={{ disabled: busy ? !stopEnabled : !canSend }}
          disabled={busy ? !stopEnabled : !canSend}
          onPress={busy ? onStop : onSend}
          style={[
            styles.send,
            {
              backgroundColor: busy ? c.textMuted : c.primary,
              opacity: (busy ? !stopEnabled : !canSend) ? 0.5 : 1,
            },
          ]}
        >
          <Icon name={busy ? 'square' : 'send'} size={18} color="onPrimary" />
        </Tap>
      </View>
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
      stickToBottom
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
  composerWrap: { alignSelf: 'stretch', gap: space.xs },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mic: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginRight: -space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    // Ocupa todo el alto de la píldora: tocar cualquier parte abre el teclado.
    alignSelf: 'stretch',
    paddingVertical: space.sm,
    // En web, WebChrome quita el anillo del navegador (con outline 'auto' Chrome lo dibuja igual).
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
