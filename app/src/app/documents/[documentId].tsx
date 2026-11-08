import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  Banner,
  ListRow,
  Sheet,
  TextField,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Screen,
  Text,
  TextLink,
  TopBar,
} from '@/components/ui';
import { extLabel } from '@/lib/upload-rules';
import {
  deleteDocument,
  loadDocumentTopics,
  moveDocument,
  renameDocument,
  useStore,
} from '@/store/store';
import { useStrings } from '@/i18n/es';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { layout, radius, space, useTheme } from '@/theme';
import { TopicOutline } from '@/components/domain/TopicOutline';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 19 · Detalle de documento, con la confirmación de eliminación (27). */
export default function DocumentDetail() {
  const s = useStrings();
  const { c } = useTheme();
  const reducedMotion = useReducedMotion();
  const { documentId, confirm } = useLocalSearchParams<{ documentId: string; confirm?: string }>();
  const record = useStore((st) => st.documents.find((d) => d.id === documentId));
  const [confirming, setConfirming] = useState(confirm === '1');
  const [sheet, setSheet] = useState<'menu' | 'rename' | 'move' | null>(null);
  const [newName, setNewName] = useState('');
  const courses = useStore((st) => st.courses);
  const [failed, setFailed] = useState(false);
  const status = record?.status;
  useEffect(() => {
    if (status === 'completed') void loadDocumentTopics(documentId);
  }, [documentId, status]);
  if (!record) return <Screen header={<TopBar title={s.document.header} />}>{null}</Screen>;
  const doc = {
    ...record,
    type: extLabel(record.name),
    size: `${record.sizeMb} MB`,
    uploaded: record.uploadedLabel,
    classification: record.path.length > 0 ? record.path : [s.live.noCourse],
  };
  /** Ejecuta un cambio en el servidor y avisa si no se pudo guardar. */
  const run = (action: Promise<boolean>, after?: () => void) => {
    setFailed(false);
    void action.then((ok) => {
      if (ok) after?.();
      else setFailed(true);
    });
  };
  return (
    <Screen
      header={
        <TopBar
          title={s.document.header}
          right={
            <IconButton
              icon="more-horizontal"
              label={s.common.more}
              onPress={() => setSheet('menu')}
            />
          }
        />
      }
      footer={<Button label={s.document.ask} onPress={() => router.push('/conversation')} />}
    >
      <View>
        <Text variant="title" accessibilityRole="header">
          {doc.name}
        </Text>
        <Text variant="caption" color="textMuted">
          {s.document.meta(doc.type, doc.size, doc.pages, doc.uploaded)}
        </Text>
      </View>
      <View style={styles.row}>
        <Chip
          label={s.live.status[doc.status]}
          tone={
            doc.status === 'failed' ? 'danger' : doc.status === 'completed' ? 'primary' : 'warning'
          }
        />
        {doc.pages > 0 ? <Chip label={s.live.pagesOf(doc.pages)} /> : null}
      </View>
      {failed ? <Banner tone="danger" title={s.live.actionFailed} /> : null}
      <Card>
        <Text variant="smallStrong" accessibilityRole="header">
          {s.document.classifiedIn}
        </Text>
        <View style={styles.row}>
          <Text variant="small" style={styles.flex}>
            {doc.classification.length > 1
              ? `${doc.classification.slice(0, -1).join(' › ')} › `
              : ''}
            <Text variant="smallStrong" color="primary">
              {doc.classification.at(-1) ?? ''}
            </Text>
          </Text>
          <TextLink label={s.common.change} onPress={() => setSheet('move')} />
        </View>
      </Card>
      {doc.outline && doc.outline.length > 0 ? (
        <>
          <Text variant="subheading" accessibilityRole="header">
            {s.document.detectedTopics}
          </Text>
          <Card>
            <TopicOutline documentId={doc.id} outline={doc.outline} />
          </Card>
        </>
      ) : null}
      <View style={styles.actions}>
        <ActionButton
          icon="edit-2"
          label={s.document.rename}
          onPress={() => {
            setNewName(record.name);
            setSheet('rename');
          }}
        />
        <ActionButton
          icon="trash-2"
          label={s.document.delete}
          danger
          onPress={() => setConfirming(true)}
        />
      </View>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={s.documentMenu.title}>
        <ListRow
          icon="message-circle"
          title={s.document.ask}
          onPress={() => {
            setSheet(null);
            router.push({
              pathname: '/conversation',
              params: { q: `Resumen de ${record.name.replace(/\.[^.]+$/u, '')}` },
            });
          }}
        />
        <ListRow
          icon="edit-2"
          title={s.document.rename}
          onPress={() => {
            setNewName(record.name);
            setSheet('rename');
          }}
        />
        <ListRow icon="folder" title={s.documentMenu.moveTitle} onPress={() => setSheet('move')} />
        <ListRow
          icon="trash-2"
          title={s.document.delete}
          danger
          divider={false}
          onPress={() => {
            setSheet(null);
            setConfirming(true);
          }}
        />
      </Sheet>
      <Sheet
        visible={sheet === 'rename'}
        onClose={() => setSheet(null)}
        title={s.documentMenu.renameTitle}
      >
        <TextField
          label={s.documentMenu.name}
          value={newName}
          onChangeText={setNewName}
          autoFocus
        />
        <Button
          label={s.documentMenu.save}
          disabled={newName.trim().length === 0}
          onPress={() => {
            setSheet(null);
            run(renameDocument(record.id, newName.trim()));
          }}
        />
      </Sheet>
      <Sheet
        visible={sheet === 'move'}
        onClose={() => setSheet(null)}
        title={s.documentMenu.moveTitle}
      >
        {courses.map((course, idx) => (
          <ListRow
            key={course.id}
            title={course.title}
            divider={idx < courses.length - 1}
            trailing={
              course.id === record.courseId ? <Icon name="check" color="primary" /> : undefined
            }
            onPress={() => {
              setSheet(null);
              run(moveDocument(record.id, course.id));
            }}
          />
        ))}
      </Sheet>
      <Modal
        visible={confirming}
        transparent
        animationType={reducedMotion ? 'fade' : 'slide'}
        onRequestClose={() => setConfirming(false)}
      >
        <View style={[styles.backdrop, { backgroundColor: c.scrim }]}>
          <View style={[styles.sheet, { backgroundColor: c.surface }]} accessibilityViewIsModal>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <View style={[styles.dangerIcon, { backgroundColor: c.dangerSoft }]}>
              <Icon name="trash-2" size={22} color="danger" />
            </View>
            <Text variant="heading" align="center" accessibilityRole="header">
              {s.document.deleteTitle}
            </Text>
            <Text variant="small" color="textMuted" align="center">
              {s.document.deleteBody(doc.name, doc.topics.length)}
            </Text>
            <View style={styles.sheetActions}>
              <Button
                label={s.document.delete}
                variant="danger"
                onPress={() => {
                  setConfirming(false);
                  run(deleteDocument(record.id), () => {
                    if (router.canGoBack()) router.back();
                    else router.replace('/courses');
                  });
                }}
              />
              <Button
                label={s.common.cancel}
                variant="secondary"
                onPress={() => setConfirming(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ActionButton({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: 'share-2' | 'edit-2' | 'trash-2';
  label: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.action, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <Icon name={icon} size={16} color={danger ? 'danger' : 'text'} />
      <Text variant="smallStrong" color={danger ? 'danger' : 'text'}>
        {label}
      </Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: layout.minTouchTarget,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xxl,
    gap: space.md,
    alignItems: 'center',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  dangerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
