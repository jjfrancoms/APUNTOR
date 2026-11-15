import { previewOnly } from '@/components/domain/PreviewOnly';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Chip, Icon, Screen, Segmented, Text, TopBar } from '@/components/ui';
import { plans } from '@/data/mock';
import { EXAM_PASS, formatSoles, studentPrice } from '@/lib/pricing';
import { choosePlan } from '@/store/store';
import { useStrings } from '@/i18n/es';
import { radius, space, useTheme } from '@/theme';
import { Tap } from '@/components/ui/Tap';

type Plan = 'free' | 'student' | 'pass';
type Billing = 'monthly' | 'yearly';

/** Pantalla 26 · Planes. Compra dentro de la app (Google Play / App Store); precios en soles con IGV. */
function Plans() {
  const s = useStrings();
  const { c } = useTheme();
  const p = s.plans;
  const [billing, setBilling] = useState<Billing>('monthly');
  const [plan, setPlan] = useState<Plan>('student');
  const names: Record<Plan, string> = { free: p.free, student: p.student, pass: p.pass };
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
          <Text variant="subheading" style={styles.flex}>
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
          {/* El precio es la cifra clave de cada tarjeta; el color de marca solo en la elegida. */}
          <Text variant="display" color={active ? 'primary' : 'text'}>
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
            <Text variant="small">{item}</Text>
          </View>
        ))}
      </Tap>
    );
  };

  // Continuar: fijo al pie en el teléfono; en pantalla ancha va tras las tarjetas, con ancho de botón.
  const cta = (
    <Button
      icon="arrow-right"
      label={p.continueWith(names[plan])}
      disabled={plan === 'free' || plan === 'pass'}
      onPress={() => {
        choosePlan('student');
        router.replace('/profile/subscription');
      }}
    />
  );

  return (
    <Screen wide={columns} header={<TopBar />} footer={columns ? undefined : cta}>
      <Text variant="display" accessibilityRole="header">
        {p.title}
      </Text>
      <View style={styles.billing}>
        <Segmented
          options={[
            { value: 'monthly', label: p.monthly },
            { value: 'yearly', label: p.yearly },
          ]}
          value={billing}
          onChange={setBilling}
        />
      </View>
      <View accessibilityRole="radiogroup" style={[styles.cards, columns && styles.cardsRow]}>
        {card('free', plans.freePrice, p.forever, p.freeItems)}
        {card('student', formatSoles(student.perMonth), p.perMonth, p.studentItems, p.recommended, {
          ...(student.before !== undefined ? { before: formatSoles(student.before) } : {}),
          note: billing === 'yearly' ? p.billedYearly(formatSoles(student.total)) : p.billedMonthly,
          ...(student.savedPerYear !== undefined
            ? { save: p.save(formatSoles(student.savedPerYear)) }
            : {}),
        })}
        {card('pass', formatSoles(EXAM_PASS), p.passUnit, p.passItems)}
      </View>
      <Text variant="caption" color="textMuted">
        {p.vatNote}
      </Text>
      {columns ? <View style={styles.cta}>{cta}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  billing: { maxWidth: 420 },
  cta: { maxWidth: 360 },
  cards: { gap: space.lg },
  cardsRow: { flexDirection: 'row', alignItems: 'stretch' },
  column: { flex: 1, minWidth: 0, gap: space.sm },
  strike: { textDecorationLine: 'line-through' },
  start: { alignItems: 'flex-start' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
});

// Usa datos de ejemplo: en la app real se muestra "Muy pronto" hasta su fase.
export default previewOnly(Plans);
