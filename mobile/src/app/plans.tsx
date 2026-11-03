import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Chip, Icon, IconButton, Screen, Segmented, Text } from '@/components/ui';
import { plans } from '@/data/mock';
import { choosePlan } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';

type Plan = 'free' | 'student' | 'school';
type Billing = 'monthly' | 'yearly';

/** Pantalla 26 · Planes. Compra dentro de la app (Google Play / App Store); precios de ejemplo. */
export default function Plans() {
  const s = useStrings();
  const { c } = useTheme();
  const p = s.plans;
  const [billing, setBilling] = useState<Billing>('monthly');
  const [plan, setPlan] = useState<Plan>('student');
  const names: Record<Plan, string> = { free: p.free, student: p.student, school: p.school };

  const card = (
    key: Plan,
    price: string,
    unit: string,
    items: readonly string[],
    badge?: string,
  ) => {
    const active = plan === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${names[key]}, ${price} ${unit}`}
        onPress={() => setPlan(key)}
        style={[
          styles.card,
          {
            backgroundColor: active ? c.primarySoft : c.surface,
            borderColor: active ? c.primary : c.border,
          },
        ]}
      >
        <View style={styles.row}>
          <Text variant="bodyStrong" style={styles.flex}>
            {names[key]}
          </Text>
          {badge ? (
            <Text variant="caption" color="primary">
              {badge}
            </Text>
          ) : null}
        </View>
        <View style={styles.price}>
          <Text variant="title" color={key === 'student' ? 'primary' : 'text'}>
            {price}
          </Text>
          {unit ? (
            <Text variant="caption" color="textMuted">
              {unit}
            </Text>
          ) : null}
        </View>
        {items.map((item) => (
          <View key={item} style={styles.row}>
            <Icon name="check" size={14} color="primary" />
            <Text variant="caption">{item}</Text>
          </View>
        ))}
      </Pressable>
    );
  };

  return (
    <Screen
      footer={
        <Button
          label={p.continueWith(names[plan])}
          disabled={plan === 'free'}
          onPress={() => {
            // Colegio o institución se cotiza a medida: va a soporte.
            if (plan === 'school') return router.push('/profile/contact');
            choosePlan('student');
            router.replace('/profile/subscription');
          }}
        />
      }
    >
      <View style={styles.row}>
        <IconButton
          icon="arrow-left"
          label={s.common.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
        />
        <Text variant="title" accessibilityRole="header">
          {p.title}
        </Text>
      </View>
      <Segmented
        options={[
          { value: 'monthly', label: p.monthly },
          { value: 'yearly', label: p.yearly },
        ]}
        value={billing}
        onChange={setBilling}
      />
      <View accessibilityRole="radiogroup" style={styles.cards}>
        {card('free', plans.freePrice, p.forever, p.freeItems)}
        {card('student', plans.studentPrice, p.perMonth, p.studentItems, p.recommended)}
        {card('school', p.custom, '', p.schoolItems)}
      </View>
      <Text variant="caption" color="textMuted">
        {p.exampleNote}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  cards: { gap: space.md },
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg, gap: space.xs + 2 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
});
