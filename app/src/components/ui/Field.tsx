import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { layout, radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

/** Borde de un campo según su estado: error > foco/abierto > reposo (y bloqueado). */
export function useFieldColors(state: { focused?: boolean; error?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return {
    border: state.error ? c.danger : state.focused ? c.primary : c.border,
    background: state.disabled ? c.surfaceAlt : c.surface,
    text: state.disabled ? c.textMuted : c.text,
    placeholder: c.textMuted,
    // Anillo suave de foco (HeroUI): un halo de `primarySoft` o `dangerSoft` alrededor del borde.
    ring: state.focused ? (state.error ? c.dangerSoft : c.primarySoft) : 'transparent',
  };
}

/**
 * Marco común de los campos (TextField, SelectField, DateField): etiqueta arriba, el control con
 * su anillo de foco y debajo el mensaje de error o la ayuda. Todo alineado a la izquierda.
 */
export function Field({
  label,
  helper,
  error,
  ring,
  children,
}: {
  label?: string;
  helper?: string;
  error?: string;
  /** Color del halo de foco (de `useFieldColors`). */
  ring: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text variant="label">{label}</Text> : null}
      {/* El halo ocupa espacio propio y se compensa con margen negativo: no mueve el diseño. */}
      <View style={[styles.ring, { backgroundColor: ring }]}>{children}</View>
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={14} color="danger" />
          <Text variant="caption" color="danger" style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="textMuted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

export const FIELD_HEIGHT = layout.primaryButtonHeight;

const RING = 3;

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  ring: {
    margin: -RING,
    padding: RING,
    borderRadius: radius.md + RING,
  },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs + 2 },
  flex: { flex: 1 },
});
