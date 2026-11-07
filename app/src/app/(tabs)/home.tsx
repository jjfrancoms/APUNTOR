import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { CourseBadge } from '@/components/domain/CourseBadge';
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  ListRow,
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
      <View>
        <Text variant="display" accessibilityRole="header">
          {s.home.hello(name)}
        </Text>
        <Text variant="small" color="textMuted">
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
    <>
      {syncError}
      <Card tone="primary" style={styles.review}>
        <Mascot size={desktop ? 112 : 80} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{s.live.askTitle}</Text>
          <Text variant="caption">{s.live.askBody}</Text>
          <View style={styles.start}>
            <Button label={s.live.askCta} compact onPress={() => router.push('/conversation')} />
          </View>
        </View>
      </Card>
      {lastDoc ? (
        <>
          {/* Encabezado de sección (sin etiqueta en mayúsculas sobre el título). */}
          <Text variant="heading">{s.live.lastDocument}</Text>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`${s.live.lastDocument}: ${lastDoc.name}`}
            onPress={() => router.push(`/documents/${lastDoc.id}`)}
          >
            <Card>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {lastDoc.name}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {lastDoc.path[0] ?? s.live.noCourse}
                  </Text>
                </View>
                <Chip
                  label={s.live.status[lastDoc.status]}
                  tone={
                    lastDoc.status === 'failed'
                      ? 'danger'
                      : lastDoc.status === 'completed'
                        ? 'primary'
                        : 'warning'
                  }
                />
                <Icon name="chevron-right" color="textMuted" />
              </View>
            </Card>
          </Tap>
        </>
      ) : null}
      <View style={styles.row}>
        <Text variant="heading" style={styles.flex}>
          {s.home.myCourses}
        </Text>
        <TextLink label={s.common.seeAll} onPress={() => router.navigate('/courses')} />
      </View>
      <Card style={styles.list}>
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
            <CourseBadge course={course} size={32} />
            <View style={styles.flex}>
              <View style={styles.row}>
                <Text variant="smallStrong" style={styles.flex}>
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
      </Card>
    </>
  );
  // Columna lateral (solo escritorio): resumen de uso y accesos rápidos.
  const side = (
    <>
      <Text variant="heading">{s.home.summary}</Text>
      <Card style={styles.summary}>
        <View style={styles.stat}>
          <Text variant="small" color="textMuted" style={styles.flex}>
            {s.home.documents}
          </Text>
          <Text variant="bodyStrong">{docCount}</Text>
        </View>
        {plan === 'free' ? (
          <View style={styles.flex}>
            <View style={styles.stat}>
              <Text variant="small" color="textMuted" style={styles.flex}>
                {s.home.questions}
              </Text>
              <Text variant="bodyStrong">{`${asked} / ${limit}`}</Text>
            </View>
            <ProgressBar value={asked / limit} label={s.home.questions} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <View style={styles.stat}>
            <Text variant="small" color="textMuted" style={styles.flex}>
              {s.home.storage}
            </Text>
            <Text variant="bodyStrong">{s.home.of(`${used} MB`, `${quota} MB`)}</Text>
          </View>
          <ProgressBar value={used / quota} label={s.home.storage} />
        </View>
      </Card>
      <Text variant="heading">{s.home.quickActions}</Text>
      <Card style={styles.list}>
        <ListRow
          icon="upload"
          title={s.live.firstUploadCta}
          onPress={() => router.push('/upload')}
        />
        <ListRow
          icon="message-circle"
          title={s.home.ask}
          divider={false}
          onPress={() => router.push('/conversation')}
        />
      </Card>
    </>
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
  review: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  skeleton: { gap: space.md },
  start: { alignItems: 'flex-start', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, gap: space.xs },
  list: { padding: 0, gap: 0 },
  summary: { gap: space.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  mainCol: { flex: 2, gap: space.lg, minWidth: 0 },
  sideCol: { flex: 1, gap: space.lg, minWidth: 0 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
