import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  Banner,
  Button,
  Checkbox,
  Icon,
  Screen,
  SelectField,
  Text,
  TextField,
  TopBar,
} from '@/components/ui';
import { useStore } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 43 · Contactar soporte. Si falla el envío, el texto se conserva (tabla de estados). */
export default function Contact() {
  const s = useStrings();
  const { c } = useTheme();
  const [message, setMessage] = useState('');
  const [technical, setTechnical] = useState(true);
  const [sent, setSent] = useState(false);
  const [topic, setTopic] = useState<string>(s.sheets.topics[0] ?? '');
  const [attachment, setAttachment] = useState<string | null>(null);
  const attach = async () => {
    const r = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: false,
    });
    if (!r.canceled && r.assets[0]) setAttachment(r.assets[0].name);
  };
  const email = useStore((st) => st.session?.email ?? 'ana@correo.com');
  return (
    <Screen
      header={<TopBar title={s.contact.header} />}
      footer={
        <Button
          label={s.contact.send}
          disabled={message.trim().length === 0}
          onPress={() => {
            setSent(true);
            setMessage('');
            setAttachment(null);
          }}
        />
      }
    >
      {sent ? <Banner tone="info" icon="check" title={s.demo.contactSent} /> : null}
      <SelectField
        label={s.contact.topic}
        options={s.sheets.topics.map((t) => ({ value: t, label: t }))}
        selected={topic}
        onSelect={setTopic}
      />
      <TextField
        label={s.contact.message}
        placeholder={s.contact.messagePlaceholder}
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Tap
        accessibilityRole="button"
        onPress={() => void attach()}
        style={[styles.select, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Icon name="image" size={16} color="primary" />
        <Text variant="smallStrong" color="primary">
          {attachment ? s.sheets.attachDone(attachment) : s.contact.attach}
        </Text>
      </Tap>
      <Checkbox checked={technical} onChange={setTechnical} label={s.contact.technical}>
        <Text variant="caption" color="textMuted">
          {s.contact.technical}
        </Text>
      </Checkbox>
      <Text variant="caption" color="textMuted">
        {s.contact.replyIn(email)}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.xs + 2 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: layout.primaryButtonHeight,
  },
  flex: { flex: 1 },
});
