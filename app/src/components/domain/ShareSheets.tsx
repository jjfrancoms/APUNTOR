import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share as NativeShare, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  Icon,
  Segmented,
  Sheet,
  Text,
  TextLink,
  IconButton,
} from '@/components/ui';
import { sharedSummary } from '@/data/mock';
import { createShare, stopSharing } from '@/store/store';
import { es, useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

export type ShareStep = 'closed' | 'create' | 'created';

/** Pantallas 35 (Compartir resumen) y 36 (Enlace creado) como hojas sobre el tema. */
export function ShareSheets({
  step,
  onStep,
  topicId,
}: {
  step: ShareStep;
  onStep: (s: ShareStep) => void;
  topicId: string;
}) {
  const s = useStrings();
  const { c } = useTheme();
  const sh = s.share;
  // Valor canónico (es.ts, el que entiende el store); la etiqueta va en el idioma elegido.
  const [expiry, setExpiry] = useState<string>(es.share.expiryOptions[1]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const link = token ? `app.ejemplo.pe/r/${token}` : sharedSummary.link;
  const url = `https://${link}`;
  const close = () => onStep('closed');
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const expiryLabel =
    expiry === es.share.expiryOptions[2] ? sh.never : sh.expires(sharedSummary.expires);
  return (
    <>
      <Sheet visible={step === 'create'} onClose={close} title={sh.header}>
        <Card style={{ backgroundColor: c.bg }}>
          <Chip label={sh.aiBadge} tone="primary" icon="star" />
          <Text variant="bodyStrong">{sharedSummary.title}</Text>
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {sharedSummary.excerpt}
          </Text>
        </Card>
        <Text variant="smallStrong" align="center" accessibilityRole="header">
          {sh.expiresIn}
        </Text>
        <Segmented
          options={es.share.expiryOptions.map((o, i) => ({
            value: o,
            label: sh.expiryOptions[i] ?? o,
          }))}
          value={expiry}
          onChange={setExpiry}
        />
        <Banner tone="info" icon="lock" title={sh.privacy} />
        <Button
          label={creating ? sh.creating : sh.create}
          loading={creating}
          onPress={() => {
            setCreating(true);
            setTimeout(() => {
              setToken(createShare(topicId, expiry));
              setCreating(false);
              setCopied(false);
              onStep('created');
            }, 500);
          }}
        />
        <View style={styles.center}>
          <TextLink label={s.common.cancel} color="textMuted" onPress={close} />
        </View>
      </Sheet>

      <Sheet visible={step === 'created'} onClose={close} title={sh.createdTitle}>
        <View style={[styles.link, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Icon name="link" size={16} color="textMuted" />
          <Text variant="small" selectable style={styles.flex}>
            {link}
          </Text>
          <IconButton
            plain
            icon={copied ? 'check' : 'copy'}
            label={sh.copyIcon}
            onPress={() => void copy()}
          />
        </View>
        <View style={styles.chips}>
          <Chip label={sh.readOnly} icon="lock" />
          <Chip label={expiryLabel} icon="clock" />
        </View>
        <Button
          label={sh.shareLink}
          onPress={() => void NativeShare.share({ message: url, url })}
        />
        <Button
          label={copied ? sh.copied : sh.copy}
          variant="secondary"
          onPress={() => void copy()}
        />
        <Tap
          accessibilityRole="button"
          onPress={() => {
            if (token) stopSharing(token);
            close();
          }}
          style={styles.stop}
        >
          <Icon name="x" size={14} color="danger" />
          <Text variant="smallStrong" color="danger">
            {sh.stop}
          </Text>
        </Tap>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: space.sm },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
  },
});
