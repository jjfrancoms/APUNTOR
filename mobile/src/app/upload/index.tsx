import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, FileRow, Icon, Screen, Text, TextLink, TopBar } from '@/components/ui';
import { uploadPicking, uploadPlan } from '@/data/mock';
import { STATUS_TONE } from '@/lib/upload';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';

/** Pantalla 2 · Subir documentos */
export default function Upload() {
  const s = useStrings();
  const { c } = useTheme();
  return (
    <Screen
      header={<TopBar title={s.upload.header} />}
      footer={
        <>
          <Button
            label={s.upload.scan}
            variant="secondary"
            icon="camera"
            onPress={() => router.push('/upload/scan')}
          />
          <Button label={s.upload.confirm} onPress={() => router.push('/upload/progress')} />
        </>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${s.upload.dropTitle}. ${s.upload.dropDetail}`}
        style={[styles.drop, { backgroundColor: c.primarySoft, borderColor: c.primary }]}
      >
        <View style={[styles.dropIcon, { backgroundColor: c.surface }]}>
          <Icon name="upload" size={20} color="primary" />
        </View>
        <Text variant="bodyStrong">{s.upload.dropTitle}</Text>
        <Text variant="caption" color="textMuted" align="center">
          {s.upload.dropDetail}
        </Text>
      </Pressable>
      <Text variant="smallStrong">{s.upload.processing(uploadPicking.length)}</Text>
      {uploadPicking.map((f) => (
        <FileRow
          key={f.id}
          ext={f.ext}
          name={f.name}
          detail={`${f.kind} · ${f.size}`}
          trailing={
            <Chip
              label={s.upload.status[f.status === 'uploading' ? 'processing' : f.status]}
              tone={STATUS_TONE[f.status]}
            />
          }
        />
      ))}
      <Card>
        <View style={styles.row}>
          <Icon name="star" size={14} color="primary" />
          <Text variant="smallStrong" style={styles.flex}>
            {s.upload.planTitle}
          </Text>
          <TextLink label={s.upload.edit} />
        </View>
        <View style={styles.crumbs}>
          {uploadPlan.map((p, i) => (
            <View key={p} style={styles.row}>
              {i > 0 ? <Icon name="chevron-right" size={12} color="textMuted" /> : null}
              <Chip label={p} />
            </View>
          ))}
        </View>
        <Text variant="caption" color="textMuted">
          {s.upload.planDetail}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  drop: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  dropIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  flex: { flex: 1 },
});
