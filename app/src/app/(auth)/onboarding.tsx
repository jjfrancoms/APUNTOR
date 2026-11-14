import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthLayout } from '@/components/domain/AuthLayout';
import { Button, Icon, Text, TextLink, type IconName } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { setLevel as saveLevel } from '@/store/store';
import { layout, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

type Level = 'school' | 'university' | 'other';
const LEVEL_ICONS: Record<Level, IconName> = {
  school: 'book-open',
  university: 'award',
  other: 'star',
};

/** Pantalla 14 · Onboarding: nivel de estudios y a Inicio (las notificaciones aún no existen). */
export default function Onboarding() {
  const s = useStrings();
  const { c } = useTheme();
  const [level, setLevel] = useState<Level>('university');
  const next = () => {
    saveLevel(level);
    router.replace('/home');
  };
  return (
    <AuthLayout
      title={s.onboarding.greeting}
      mood="happy"
      footer={
        <>
          <Button label={s.common.continue} onPress={next} />
          <View style={styles.start}>
            <TextLink label={s.onboarding.skip} color="textMuted" onPress={next} />
          </View>
        </>
      }
    >
      {/* Opciones como filas separadas por líneas finas; solo la elegida lleva fondo de marca. */}
      <View accessibilityRole="radiogroup" style={[styles.options, { borderColor: c.border }]}>
        {(Object.keys(s.onboarding.levels) as Level[]).map((key, i) => {
          const selected = key === level;
          const item = s.onboarding.levels[key];
          return (
            <Tap
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.title}. ${item.detail}`}
              onPress={() => setLevel(key)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? c.primarySoft : 'transparent',
                  borderTopColor: c.border,
                  borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              <Icon name={LEVEL_ICONS[key]} size={20} color={selected ? 'primary' : 'textMuted'} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" color={selected ? 'primary' : 'text'}>
                  {item.title}
                </Text>
                <Text variant="caption" color="textMuted">
                  {item.detail}
                </Text>
              </View>
              {selected ? <Icon name="check" size={20} color="primary" /> : null}
            </Tap>
          );
        })}
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  options: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: layout.minTouchTarget + 12,
  },
  flex: { flex: 1 },
  start: { alignItems: 'flex-start' },
});
