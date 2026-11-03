import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Mascot, Screen, Text, TextLink, type IconName } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { layout, radius, space, useTheme } from '@/theme';

type Level = 'school' | 'university' | 'other';
const LEVEL_ICONS: Record<Level, IconName> = {
  school: 'book-open',
  university: 'award',
  other: 'star',
};
const TOTAL_STEPS = 3;

/** Pantalla 14 · Onboarding (paso 1: nivel). Los pasos 2 y 3 aún no están diseñados. */
export default function Onboarding() {
  const s = useStrings();
  const { c } = useTheme();
  const [level, setLevel] = useState<Level>('university');
  const next = () => router.push('/notifications-permission');
  return (
    <Screen
      footer={
        <>
          <Button label={s.common.continue} onPress={next} />
          <View style={styles.center}>
            <TextLink label={s.onboarding.skip} color="textMuted" onPress={next} />
          </View>
        </>
      }
    >
      <View style={styles.steps} accessibilityLabel={s.onboarding.step(1, TOTAL_STEPS)}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[styles.step, { backgroundColor: i === 0 ? c.primary : c.border }]}
          />
        ))}
      </View>
      <Text variant="caption" color="textMuted">
        {s.onboarding.step(1, TOTAL_STEPS)}
      </Text>
      <View style={styles.bubbleRow}>
        <Mascot size={64} />
        <View style={[styles.bubble, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text variant="smallStrong">{s.onboarding.greeting}</Text>
        </View>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {(Object.keys(s.onboarding.levels) as Level[]).map((key) => {
          const selected = key === level;
          const item = s.onboarding.levels[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.title}. ${item.detail}`}
              onPress={() => setLevel(key)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? c.primarySoft : c.surface,
                  borderColor: selected ? c.primary : c.border,
                },
              ]}
            >
              <View
                style={[
                  styles.optionIcon,
                  { backgroundColor: selected ? c.surface : c.surfaceAlt },
                ]}
              >
                <Icon name={LEVEL_ICONS[key]} size={18} color={selected ? 'primary' : 'text'} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong" color={selected ? 'primary' : 'text'}>
                  {item.title}
                </Text>
                <Text variant="caption" color="textMuted">
                  {item.detail}
                </Text>
              </View>
              {selected ? <Icon name="check-circle" size={20} color="primary" /> : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  step: { flex: 1, height: 4, borderRadius: 2 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bubble: { flex: 1, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  options: { gap: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    minHeight: layout.minTouchTarget + 20,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
});
