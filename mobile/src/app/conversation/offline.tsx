import {
  ChatScreen,
  Composer,
  MascotBubble,
  MascotStage,
  SourceChips,
  UserBubble,
} from '@/components/chat/Chat';
import { Banner, Text } from '@/components/ui';
import { chatOffline } from '@/data/mock';
import { useStrings } from '@/i18n/es';

/** Pantalla 10 · Chat sin conexión: solo material propio, con chip "Externo · sin red". */
export default function ChatOffline() {
  const s = useStrings();
  return (
    <ChatScreen
      subtitle={s.chat.offlineSubtitle}
      withHistory={false}
      composer={<Composer placeholder={s.chat.placeholder} />}
    >
      <Banner tone="warning" icon="wifi-off" title={s.chat.offlineBanner} />
      <MascotStage label={s.chat.lightModel} mood="curious" />
      <UserBubble text={chatOffline.question} />
      <MascotBubble
        sources={<SourceChips page={chatOffline.page} external={s.chat.externalOffline} />}
      >
        <Text variant="small">{chatOffline.answer}</Text>
      </MascotBubble>
    </ChatScreen>
  );
}
