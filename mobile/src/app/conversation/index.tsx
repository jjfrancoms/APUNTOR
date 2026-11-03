import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ChatScreen,
  Composer,
  courseCount,
  MascotBubble,
  MascotStage,
  SourceChips,
  UserBubble,
} from '@/components/chat/Chat';
import { Text } from '@/components/ui';
import { chatSample } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

/** Pantalla 5 · Chat con la mascota. Responde solo con tus documentos y cita la página. */
export default function Conversation() {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <ChatScreen
      subtitle={s.chat.knows(courseCount)}
      composer={
        <>
          <View style={styles.suggestions}>
            {s.chat.suggestions.map((label) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                onPress={() => label === s.chat.suggestions[1] && router.push('/study/quiz-setup')}
                style={[styles.suggestion, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <Text variant="smallStrong" color="primary">
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Composer placeholder={s.chat.placeholder} />
        </>
      }
    >
      <MascotStage label={s.chat.animated} />
      <UserBubble text={chatSample.question} />
      <MascotBubble
        sources={
          <SourceChips
            page={chatSample.page}
            external={s.chat.externalCount(chatSample.external)}
          />
        }
      >
        <Text variant="small">{chatSample.answer}</Text>
      </MascotBubble>
    </ChatScreen>
  );
}

const styles = StyleSheet.create({
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  suggestion: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: layout.minTouchTarget - 8,
    justifyContent: 'center',
  },
});
