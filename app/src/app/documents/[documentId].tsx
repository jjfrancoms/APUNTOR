import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  Banner,
  ListRow,
  Sheet,
  TextField,
  Button,
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
import { useLanguage } from '@/i18n/language';
import { formatDate, isToday } from '@/lib/format';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { radius, space, useTheme, useWide } from '@/theme';
import { TopicOutline } from '@/components/domain/TopicOutline';

/** Pantalla 19 · Detalle de documento, con la confirmación de eliminación (27). */
export default function DocumentDetail() {
  const s = useStrings();
  const language = useLanguage();
  const { c } = useTheme();
  const wide = useWide();
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
    uploaded: isToday(record.createdAt) ? s.document.today : formatDate(record.createdAt, language),
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
      wide
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
      footer={
        <>
          <Button
            label={s.document.ask}
            onPress={() => router.push({ pathname: '/conversation', params: { docs: record.id } })}
          />
          {record.status === 'completed' ? (
            <View style={styles.row}>
              {(['quiz', 'cards'] as const).map((kind) => (
                <View key={kind} style={styles.flex}>
                  <Button
                    label={kind === 'quiz' ? s.study.practice : s.study.cards}
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: '/study/quiz-setup',
                        params: { doc: record.id, kind },
                      })
                    }
                  />
                </View>
              ))}
            </View>
          ) : null}
        </>
      }
    >
      <View style={[styles.layout, wide && styles.layoutWide]}>
        <View style={[styles.info, wide && styles.infoWide]}>
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
                doc.status === 'failed'
                  ? 'danger'
                  : doc.status === 'completed'
                    ? 'primary'
                    : 'warning'
              }
            />
            {doc.pages > 0 ? <Chip label={s.live.pagesOf(doc.pages)} /> : null}
          </View>
          {failed ? <Banner tone="danger" title={s.live.actionFailed} /> : null}
          <View style={[styles.rule, { borderTopColor: c.border }]}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
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
          </View>
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                label={s.document.rename}
                icon="edit-2"
                variant="secondary"
                size="sm"
                onPress={() => {
                  setNewName(record.name);
                  setSheet('rename');
                }}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={s.document.delete}
                icon="trash-2"
                variant="dangerOutline"
                size="sm"
                onPress={() => setConfirming(true)}
              />
            </View>
          </View>
        </View>
        {doc.outline && doc.outline.length > 0 ? (
          <View style={styles.topics}>
            <Text variant="heading" accessibilityRole="header">
              {s.document.detectedTopics}
            </Text>
            <TopicOutline documentId={doc.id} outline={doc.outline} />
          </View>
        ) : null}
      </View>

      <Sheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={s.documentMenu.title}>
        <ListRow
          icon="message-circle"
          title={s.document.ask}
          onPress={() => {
            setSheet(null);
            router.push({
              pathname: '/conversation',
              params: {
                q: s.document.summaryPrompt(record.name.replace(/\.[^.]+$/u, '')),
                docs: record.id,
              },
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
            <Text variant="heading" accessibilityRole="header">
              {s.document.deleteTitle}
            </Text>
            <Text variant="small" color="textMuted">
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  layout: { gap: space.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  info: { gap: space.md },
  infoWide: { width: 360 },
  topics: { flex: 1, minWidth: 0, gap: space.sm },
  rule: { gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xxl,
    gap: space.md,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetActions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
