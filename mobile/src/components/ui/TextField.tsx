import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { fonts, layout, radius, space, useTheme } from '@/theme';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensaje de error en línea, bajo el campo. */
  error?: string;
  multiline?: boolean;
  /** Control a la derecha dentro del campo (p. ej. el botón de calendario). */
  trailing?: ReactNode;
}

export function TextField({
  label,
  error,
  multiline,
  trailing,
  onFocus,
  onBlur,
  ...input
}: TextFieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="smallStrong">{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={c.textMuted}
          multiline={multiline}
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
            {
              color: c.text,
              backgroundColor: c.surface,
              // El foco se indica con el borde (en web se quita el contorno del navegador).
              borderColor: error ? c.danger : focused ? c.primary : c.border,
              minHeight: multiline ? 120 : layout.primaryButtonHeight,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            trailing ? styles.withTrailing : null,
          ]}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
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
