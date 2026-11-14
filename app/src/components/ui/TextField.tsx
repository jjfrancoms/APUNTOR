import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { fonts, layout, radius, space, webTransition } from '@/theme';
import { Field, FIELD_HEIGHT, useFieldColors } from './Field';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensaje de error en línea, bajo el campo (con ícono, nunca solo color). */
  error?: string;
  /** Texto de ayuda bajo el campo; se oculta mientras haya un error. */
  helper?: string;
  multiline?: boolean;
  /** Control a la derecha dentro del campo (p. ej. el botón de calendario). */
  trailing?: ReactNode;
}

/** Campo de texto (referencia: HeroUI Input): etiqueta arriba, foco con borde y halo de marca. */
export function TextField({
  label,
  error,
  helper,
  multiline,
  trailing,
  onFocus,
  onBlur,
  editable,
  ...input
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;
  const colors = useFieldColors({ focused, error, disabled });
  const reduced = useReducedMotion();
  return (
    <Field label={label} helper={helper} error={error} ring={colors.ring}>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          multiline={multiline}
          editable={editable}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            webTransition(reduced, ['border-color', 'background-color'], 'base'),
            {
              color: colors.text,
              backgroundColor: colors.background,
              // El foco se indica con el borde (en web se quita el contorno del navegador).
              borderColor: colors.border,
              minHeight: multiline ? 120 : FIELD_HEIGHT,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            trailing ? styles.withTrailing : null,
          ]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  withTrailing: { paddingRight: layout.minTouchTarget + space.sm },
  trailing: {
    position: 'absolute',
    right: space.xs,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    // En web, WebChrome quita el anillo del navegador (con outline 'auto' Chrome lo dibuja igual).
    outlineWidth: 0,
    outlineColor: 'transparent',
  },
});
