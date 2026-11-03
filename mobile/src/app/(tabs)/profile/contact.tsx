import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Icon, Screen, Text, TextField, TopBar } from '@/components/ui';
import { user } from '@/data/mock';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

/** Pantalla 43 · Contactar soporte. Si falla el envío, el texto se conserva (tabla de estados). */
export default function Contact() {
  const s = useStrings();
  const { c } = useTheme();
  const [message, setMessage] = useState('');
  const [technical, setTechnical] = useState(true);
  return (
    <Screen
      header={<TopBar title={s.contact.header} />}
      footer={<Button label={s.contact.send} disabled={message.trim().length === 0} />}
    >
      <View style={styles.gap}>
        <Text variant="smallStrong">{s.contact.topic}</Text>
        <Pressable
          accessibilityRole="combobox"
          accessibilityLabel={`${s.contact.topic}: ${s.contact.topicValue}`}
          style={[styles.select, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text variant="body" style={styles.flex}>
            {s.contact.topicValue}
          </Text>
          <Icon name="chevron-down" color="textMuted" />
        </Pressable>
      </View>
      <TextField
        label={s.contact.message}
        placeholder={s.contact.messagePlaceholder}
        value={message}
        onChangeText={setMessage}
        multiline
      />
      <Pressable
        accessibilityRole="button"
        style={[styles.select, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Icon name="image" size={16} color="primary" />
        <Text variant="smallStrong" color="primary">
          {s.contact.attach}
        </Text>
      </Pressable>
      <Checkbox checked={technical} onChange={setTechnical} label={s.contact.technical}>
        <Text variant="caption" color="textMuted">
          {s.contact.technical}
        </Text>
      </Checkbox>
      <Text variant="caption" color="textMuted">
        {s.contact.replyIn(user.email)}
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
