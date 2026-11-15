import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Mascot,
  ProgressBar,
  Screen,
  Text,
  TextLink,
} from '@/components/ui';
import {
  dailyQuestionLimit,
  questionsToday,
  quotaMb,
  refreshAll,
  usedMb,
  useStore,
} from '@/store/store';
import { useStrings } from '@/i18n/es';
import { formatPercent } from '@/lib/format';
import { layout, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

/** Pantalla 6 · Inicio */
export default function Home() {
  const s = useStrings();
  const { c } = useTheme();
  const name = useStore((st) => st.session?.name ?? '');
  const courses = useStore((st) => st.courses);
  const docCount = useStore((st) => st.documents.length);
  const lastDoc = useStore((st) => st.documents[0]);
  // La última conversación con mensajes: lo que se puede retomar sin buscarlo.
  const lastConv = useStore((st) =>
    st.conversations
      .filter((conv) => conv.messages.length > 0)
      .reduce<(typeof st.conversations)[number] | undefined>(
        (best, conv) => (best === undefined || conv.updatedAt > best.updatedAt ? conv : best),
        undefined,
      ),
  );
  const sync = useStore((st) => st.sync);
  const asked = useStore(questionsToday);
  const limit = useStore(dailyQuestionLimit);
  const plan = useStore((st) => st.plan);
  const used = useStore(usedMb);
  const quota = useStore(quotaMb);
  const desktop = useWindowDimensions().width >= layout.breakpoints.desktop;
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  // Pantalla 51 · Inicio cargando: esqueleto con la forma de la pantalla.
  if (demo === 'loading' || (sync.loading && docCount === 0 && courses.length === 0)) {
    return (
      <Screen>
        <View
          accessibilityLabel={s.empty.loading}
          accessibilityRole="progressbar"
          style={styles.skeleton}
        >
          {[
            { w: '45%', h: 28 },
            { w: '65%', h: 14 },
            { w: '100%', h: 120 },
            { w: '100%', h: 96 },
            { w: '35%', h: 18 },
            { w: '100%', h: 64 },
            { w: '100%', h: 64 },
            { w: '100%', h: 64 },
          ].map((b, i) => (
            <View
              key={i}
              style={{
                width: b.w as `${number}%`,
                height: b.h,
                borderRadius: 12,
                backgroundColor: c.surfaceAlt,
              }}
            />
          ))}
        </View>
      </Screen>
    );
  }
  const greetingBlock = (
    <>
      <View style={styles.greeting}>
        <Text variant="display" accessibilityRole="header">
          {s.home.hello(name)}
        </Text>
        <Text variant="lead" color="textMuted">
          {s.home.subtitle}
        </Text>
      </View>
    </>
  );
  const syncError = sync.error ? (
    <Banner tone="danger" title={s.errors[sync.error]}>
      <TextLink label={s.live.retry} color="danger" onPress={() => void refreshAll()} />
    </Banner>
  ) : null;
  if (docCount === 0) {
    return (
      <Screen>
        {greetingBlock}
        {syncError}
        <EmptyState
          title={s.live.firstUploadTitle}
          body={s.live.firstUploadBody}
          primary={{ label: s.live.firstUploadCta, onPress: () => router.push('/upload') }}
        />
      </Screen>
    );
  }
  const main = (
    <View style={styles.sections}>
      {syncError}
      {/* Invitación a preguntar: fila simple, sin recuadro; separada por una línea fina. */}
      <View style={[styles.ask, { borderBottomColor: c.border }]}>
        <Mascot size={56} />
        <View style={styles.flex}>
          <Text variant="heading">{s.live.askTitle}</Text>
          <Text variant="body" color="textMuted">
            {s.live.askBody}
          </Text>
          <View style={styles.start}>
            <Button
              icon="message-circle"
              label={s.live.askCta}
              onPress={() => router.push('/conversation')}
            />
          </View>
        </View>
      </View>
      {/* Zeigarnik: lo que quedó a medias va primero, con un toque para retomarlo. */}
      {lastConv || lastDoc ? (
        <View style={styles.section}>
          <Text variant="heading">{s.home.resume}</Text>
          <View>
            {lastConv ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${s.home.resumeChat}: ${lastConv.title}`}
                onPress={() => router.push(`/conversation?id=${lastConv.id}`)}
              >
                <View style={styles.bareRow}>
                  <View style={styles.row}>
                    <Icon name="message-circle" color="textMuted" />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {lastConv.title}
                      </Text>
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {`${s.home.resumeChat} · ${lastConv.course}`}
                      </Text>
                    </View>
                    <Icon name="chevron-right" color="textMuted" />
                  </View>
                </View>
              </Tap>
            ) : null}
            {lastDoc ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`${s.live.lastDocument}: ${lastDoc.name}`}
                onPress={() => router.push(`/documents/${lastDoc.id}`)}
              >
                {/* Fila sin caja: solo espacio vertical, sin borde ni fondo. */}
                <View style={styles.bareRow}>
                  <View style={styles.row}>
                    <Icon name="file-text" color="textMuted" />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {lastDoc.name}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {lastDoc.path[0] ?? s.live.noCourse}
                      </Text>
                    </View>
                    {lastDoc.status === 'completed' ? null : (
                      <Chip
                        label={s.live.status[lastDoc.status]}
                        tone={lastDoc.status === 'failed' ? 'danger' : 'warning'}
                      />
                    )}
                    <Icon name="chevron-right" color="textMuted" />
                  </View>
                </View>
              </Tap>
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text variant="heading" style={styles.flex}>
            {s.home.myCourses}
          </Text>
          <TextLink label={s.common.seeAll} onPress={() => router.navigate('/courses')} />
        </View>
        <View style={styles.list}>
          {courses.map((course, i) => (
            <Tap
              key={course.id}
              accessibilityRole="button"
              accessibilityLabel={`${course.title}, ${formatPercent(course.progress)}`}
              onPress={() => router.push(`/courses/${course.id}`)}
              style={[
                styles.courseRow,
                i > 0 && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <Icon
                name={course.icon}
                size={20}
                color={course.tone === 'primary' ? 'primary' : 'textMuted'}
              />
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text variant="bodyStrong" style={styles.flex}>
                    {course.title}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {formatPercent(course.progress)}
                  </Text>
                </View>
                <ProgressBar value={course.progress} label={course.title} />
              </View>
            </Tap>
          ))}
        </View>
      </View>
    </View>
  );
  // Columna lateral (solo escritorio): resumen de uso y accesos rápidos.
  const side = (
    <View style={styles.section}>
      <Text variant="heading">{s.home.summary}</Text>
      <Card style={styles.summary}>
        {/* La cuota de preguntas es la cifra clave: grande y en el color de marca. */}
        {plan === 'free' ? (
          <View style={styles.stat}>
            <Text variant="small" color="textMuted">
              {s.home.questions}
            </Text>
            <View style={styles.quota}>
              <Text variant="numeral" color="primary">
                {String(asked)}
              </Text>
              <Text variant="lead" color="textMuted">{`/ ${limit}`}</Text>
            </View>
            <ProgressBar value={asked / limit} label={s.home.questions} />
          </View>
        ) : null}
        <View style={styles.stat}>
          <Text variant="small" color="textMuted">
            {s.home.documents}
          </Text>
          <Text variant="title">{docCount}</Text>
        </View>
        <View style={styles.stat}>
          <Text variant="small" color="textMuted">
            {s.home.storage}
          </Text>
          <Text variant="subheading">{s.home.of(`${used} MB`, `${quota} MB`)}</Text>
          <ProgressBar value={used / quota} label={s.home.storage} />
        </View>
      </Card>
    </View>
  );
  if (desktop) {
    return (
      <Screen wide>
        {greetingBlock}
        <View style={styles.columns}>
          <View style={styles.mainCol}>{main}</View>
          <View style={styles.sideCol}>{side}</View>
        </View>
      </Screen>
    );
  }
  return (
    <Screen>
      {greetingBlock}
      {main}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: space.xs },
  // Entre secciones hay más aire que dentro de cada una (título pegado a su contenido).
  sections: { gap: space.xxxl },
  section: { gap: space.md },
  ask: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.lg,
    paddingBottom: space.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeleton: { gap: space.md },
  start: { alignItems: 'flex-start', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, gap: space.xs },
  list: { gap: 0 },
  actions: { alignItems: 'flex-start', gap: space.xs },
  summary: { gap: space.xl },
  stat: { gap: space.xs },
  quota: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  mainCol: { flex: 2, minWidth: 0 },
  sideCol: { flex: 1, minWidth: 0 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
  },
  bareRow: { paddingVertical: space.sm, minHeight: 44, justifyContent: 'center' },
});
