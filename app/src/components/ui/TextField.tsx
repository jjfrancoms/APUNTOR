import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useStrings } from '@/i18n/es';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { fonts, layout, radius, space, webTransition } from '@/theme';
import { Field, FIELD_HEIGHT, useFieldColors } from './Field';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Mensaje de error en línea, bajo el campo (con ícono, nunca solo color). */
  error?: string;
  /** Texto de ayuda bajo el campo; se oculta mientras haya un error. */
  helper?: string;
  multiline?: boolean;
  /** Control a la derecha dentro del campo (p. ej. el botón de calendario). */
  trailing?: ReactNode;
  /** Ícono a la izquierda dentro del campo (correo, candado…). Decorativo: la etiqueta sigue arriba. */
  icon?: IconName;
  /**
   * Campo de contraseña con ojo para mostrar u ocultar lo escrito. Empieza oculto; reemplaza a
   * `trailing` y a `secureTextEntry`.
   */
  secureToggle?: boolean;
}

/** Campo de texto (referencia: HeroUI Input): etiqueta arriba, foco con borde y halo de marca. */
export function TextField({
  label,
  error,
  helper,
  multiline,
  trailing,
  icon,
  secureToggle,
  onFocus,
  onBlur,
  editable,
  ...input
}: TextFieldProps) {
  const s = useStrings();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const disabled = editable === false;
  const colors = useFieldColors({ focused, error, disabled });
  const reduced = useReducedMotion();
  const eye = secureToggle === true;
  const end: ReactNode = eye ? (
    <IconButton
      plain
      edge="none"
      icon={hidden ? 'eye' : 'eye-off'}
      label={hidden ? s.common.showPassword : s.common.hidePassword}
      onPress={() => setHidden((v) => !v)}
    />
  ) : (
    trailing
  );
  return (
    <Field label={label} helper={helper} error={error} ring={colors.ring}>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.placeholder}
          multiline={multiline}
          editable={editable}
          {...input}
          secureTextEntry={eye ? hidden : input.secureTextEntry}
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
            end ? styles.withTrailing : null,
            icon ? styles.withIcon : null,
          ]}
        />
        {icon ? (
          <View style={styles.leading} pointerEvents="none">
            <Icon name={icon} size={18} color="textMuted" />
          </View>
        ) : null}
        {end ? <View style={styles.trailing}>{end}</View> : null}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  // Deja sitio al ícono de la izquierda (16 de margen + 18 de ícono + 12 de aire).
  withIcon: { paddingLeft: space.lg + 18 + space.md },
  leading: {
    position: 'absolute',
    left: space.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
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
