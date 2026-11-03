import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Chip, Icon, IconButton, Screen, Segmented, Text } from '@/components/ui';
import { plans } from '@/data/mock';
import { formatSoles, studentPrice } from '@/lib/pricing';
import { choosePlan } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

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
  // Tres columnas cuando hay espacio (tablet ancha y escritorio); en móvil, una debajo de otra.
  const columns = useWindowDimensions().width >= 840;
  const student = studentPrice(billing);

  const card = (
    key: Plan,
    price: string,
    unit: string,
    items: readonly string[],
    badge?: string,
    extra?: { before?: string; note?: string; save?: string },
  ) => {
    const active = plan === key;
    return (
      <Tap
        key={key}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${names[key]}, ${price} ${unit}`}
        onPress={() => setPlan(key)}
        style={[
          styles.card,
          columns && styles.column,
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
          {extra?.before ? (
            <Text variant="bodyStrong" color="textMuted" style={styles.strike}>
              {extra.before}
            </Text>
          ) : null}
          <Text variant="title" color={key === 'student' ? 'primary' : 'text'}>
            {price}
          </Text>
          {unit ? (
            <Text variant="caption" color="textMuted">
              {unit}
            </Text>
          ) : null}
        </View>
        {extra?.note ? (
          <Text variant="caption" color="textMuted">
            {extra.note}
          </Text>
        ) : null}
        {extra?.save ? (
          <View style={styles.start}>
            <Chip label={extra.save} tone="primary" icon="tag" />
          </View>
        ) : null}
        {items.map((item) => (
          <View key={item} style={styles.row}>
            <Icon name="check" size={14} color="primary" />
            <Text variant="caption">{item}</Text>
          </View>
        ))}
      </Tap>
    );
  };

  return (
    <Screen
      wide={columns}
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
      <View accessibilityRole="radiogroup" style={[styles.cards, columns && styles.cardsRow]}>
        {card('free', plans.freePrice, p.forever, p.freeItems)}
        {card('student', formatSoles(student.perMonth), p.perMonth, p.studentItems, p.recommended, {
          ...(student.before !== undefined ? { before: formatSoles(student.before) } : {}),
          note: billing === 'yearly' ? p.billedYearly(formatSoles(student.total)) : p.billedMonthly,
          ...(student.savedPerYear !== undefined
            ? { save: p.save(formatSoles(student.savedPerYear)) }
            : {}),
        })}
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
  cardsRow: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flex: 1, minWidth: 0, gap: space.sm },
  strike: { textDecorationLine: 'line-through' },
  start: { alignItems: 'flex-start' },
  card: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg, gap: space.xs + 2 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
});
