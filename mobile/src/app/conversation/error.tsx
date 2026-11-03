import { router } from 'expo-router';
import { ChatScreen, Composer, courseCount, UserBubble } from '@/components/chat/Chat';
import { Banner, Button, ProgressBar, Text, TextLink } from '@/components/ui';
import { dailyLimit } from '@/data/mock';
import { useStrings } from '@/i18n/es';

/** Pantalla 25 · Error o límite (CHAT_FAILED, CHAT_DAILY_LIMIT). El mensaje no se pierde. */
export default function ChatError() {
  const s = useStrings();
  return (
    <ChatScreen
      subtitle={s.chat.knowsShort(courseCount)}
      composer={<Composer placeholder={s.chat.placeholderShort} disabled />}
    >
      <UserBubble text="Hazme un resumen de la Clase 3" />
      <Banner tone="danger" title={s.chat.failedTitle} body={s.errors.CHAT_FAILED}>
        <TextLink label={s.chat.retry} color="danger" />
      </Banner>
      <Banner tone="warning" icon="clock" title={s.errors.CHAT_DAILY_LIMIT}>
        <Text variant="caption">
          {s.chat.limitBody(dailyLimit.used, dailyLimit.total, dailyLimit.renewsIn)}
        </Text>
        <ProgressBar
          value={dailyLimit.used / dailyLimit.total}
          tone="accent"
          label={s.errors.CHAT_DAILY_LIMIT}
        />
        <Button label={s.chat.seePlans} onPress={() => router.push('/plans')} />
      </Banner>
    </ChatScreen>
  );
}
