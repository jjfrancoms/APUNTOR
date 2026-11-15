import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useStrings } from '@/i18n/es';
import { formatDayMonthYear, isAfterDay, monthGrid, yearRange } from '@/lib/calendar';
import { formatBirthInput, parseBirthDate } from '@/lib/validation';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { TextField } from './TextField';
import { Tap } from './Tap';

type Mode = 'days' | 'months' | 'years';

/**
 * Campo de fecha (DD/MM/AAAA): se puede escribir o elegir en el calendario, que se despliega
 * en línea bajo el campo (igual que los selectores). No deja elegir fechas futuras.
 */
export function DateField({
  label,
  placeholder,
  value,
  onChange,
  error,
  helper,
  /** Mes que se muestra al abrir si aún no hay fecha (por defecto, hace 18 años). */
  initialYearsAgo = 18,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Texto de ayuda bajo el campo; se oculta mientras haya un error. */
  helper?: string;
  initialYearsAgo?: number;
}) {
  const s = useStrings();
  const k = s.calendar;
  const { c } = useTheme();
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('days');
  const start = (): { y: number; m: number } => {
    const parsed = parseBirthDate(value, today);
    return parsed
      ? { y: parsed.getFullYear(), m: parsed.getMonth() }
      : { y: today.getFullYear() - initialYearsAgo, m: today.getMonth() };
  };
  const [view, setView] = useState(start);
  const selected = parseBirthDate(value, today);

  const toggle = () => {
    if (!open) {
      setView(start());
      setMode('days');
    }
    setOpen(!open);
  };
  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const t = y * 12 + m + delta;
      return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
    });
  const atMax =
    view.y > today.getFullYear() || (view.y === today.getFullYear() && view.m >= today.getMonth());
  const monthName = k.months[view.m] ?? '';

  const headButton = (labelText: string, a11y: string, next: Mode) => (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${a11y}: ${labelText}`}
      onPress={() => setMode(mode === next ? 'days' : next)}
      style={[styles.headButton, mode === next && { backgroundColor: c.primarySoft }]}
    >
      <Text variant="bodyStrong">{labelText}</Text>
      <Icon name={mode === next ? 'chevron-up' : 'chevron-down'} size={14} color="textMuted" />
    </Tap>
  );

  return (
    <View style={styles.wrap}>
      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={(v) => onChange(formatBirthInput(v))}
        keyboardType="number-pad"
        autoComplete="birthdate-full"
        error={error}
        helper={helper}
        trailing={
          <Tap
            accessibilityRole="button"
            accessibilityLabel={s.register.openCalendar}
            accessibilityState={{ expanded: open }}
            onPress={toggle}
            hitSlop={4}
            style={[styles.iconButton, open && { backgroundColor: c.primarySoft }]}
          >
            <Icon name="calendar" size={20} color={open ? 'primary' : 'textMuted'} />
          </Tap>
        }
      />
      {open ? (
        <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.head}>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={k.prevMonth}
              onPress={() => shift(-1)}
              style={styles.arrow}
            >
              <Icon name="chevron-left" color="text" />
            </Tap>
            <View style={styles.headCenter}>
              {headButton(monthName, k.chooseMonth, 'months')}
              {headButton(String(view.y), k.chooseYear, 'years')}
            </View>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={k.nextMonth}
              accessibilityState={{ disabled: atMax }}
              disabled={atMax}
              onPress={() => shift(1)}
              style={[styles.arrow, atMax && styles.disabled]}
            >
              <Icon name="chevron-right" color="text" />
            </Tap>
          </View>

          {mode === 'years' ? (
            <ScrollView style={styles.years} nestedScrollEnabled>
              <View style={styles.grid}>
                {yearRange(today.getFullYear()).map((y) => {
                  const active = y === view.y;
                  return (
                    <Tap
                      key={y}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        setView(({ m }) => ({ y, m }));
                        setMode('days');
                      }}
                      style={[styles.cell4, styles.pill, active && { backgroundColor: c.primary }]}
                    >
                      <Text variant="smallStrong" color={active ? 'onPrimary' : 'text'}>
                        {String(y)}
                      </Text>
                    </Tap>
                  );
                })}
              </View>
            </ScrollView>
          ) : mode === 'months' ? (
            <View style={styles.grid}>
              {k.months.map((name, m) => {
                const active = m === view.m;
                const future = view.y === today.getFullYear() && m > today.getMonth();
                return (
                  <Tap
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: future }}
                    disabled={future}
                    onPress={() => {
                      setView(({ y }) => ({ y, m }));
                      setMode('days');
                    }}
                    style={[
                      styles.cell3,
                      styles.pill,
                      active && { backgroundColor: c.primary },
                      future && styles.disabled,
                    ]}
                  >
                    <Text variant="smallStrong" color={active ? 'onPrimary' : 'text'}>
                      {name.slice(0, 3)}
                    </Text>
                  </Tap>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.grid}>
                {k.weekdays.map((d, i) => (
                  <View key={`${d}-${i}`} style={styles.cell7}>
                    <Text variant="caption" color="textMuted">
                      {d}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.grid}>
                {monthGrid(view.y, view.m).map((day, i) => {
                  if (day === null) return <View key={`e${i}`} style={styles.cell7} />;
                  const date = new Date(view.y, view.m, day);
                  const future = isAfterDay(date, today);
                  const active =
                    selected !== null &&
                    selected.getFullYear() === view.y &&
                    selected.getMonth() === view.m &&
                    selected.getDate() === day;
                  return (
                    <View key={day} style={styles.cell7}>
                      <Tap
                        accessibilityRole="button"
                        accessibilityLabel={k.day(day, monthName, view.y)}
                        accessibilityState={{ selected: active, disabled: future }}
                        disabled={future}
                        onPress={() => {
                          onChange(formatDayMonthYear(view.y, view.m, day));
                          setOpen(false);
                        }}
                        style={[
                          styles.day,
                          active && { backgroundColor: c.primary },
                          future && styles.disabled,
                        ]}
                      >
                        <Text variant="small" color={active ? 'onPrimary' : 'text'}>
                          {String(day)}
                        </Text>
                      </Tap>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center' },
  headCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  headButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    minHeight: 40,
    borderRadius: radius.sm,
  },
  arrow: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell7: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  cell4: { width: '25%' },
  cell3: { width: `${100 / 3}%` },
  pill: { alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: radius.md },
  // Mínimos (no tamaños fijos): con texto grande del sistema, el número no se recorta.
  day: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  years: { maxHeight: 240 },
  disabled: { opacity: 0.3 },
});
