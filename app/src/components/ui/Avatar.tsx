import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { fonts, useTheme } from '@/theme';
import { Text } from './Text';

export type AvatarSize = 'sm' | 'md' | 'lg';

const DIAMETER: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 64 };
const FONT: Record<AvatarSize, number> = { sm: 12, md: 16, lg: 24 };

/** Hasta dos iniciales (primera letra de las dos primeras palabras) en mayúsculas. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => Array.from(p)[0] ?? '');
  return letters.join('').toLocaleUpperCase();
}

/**
 * Avatar (referencia: HeroUI Avatar con respaldo): foto si hay `uri` y carga; si no, las
 * iniciales sobre `primarySoft`. Es decorativo salvo que se pase `accessibilityLabel`.
 */
export function Avatar({
  name,
  uri,
  size = 'md',
  accessibilityLabel,
}: {
  name: string;
  uri?: string;
  size?: AvatarSize;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const d = DIAMETER[size];
  const showImage = uri !== undefined && uri !== '' && !failed;
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole={accessibilityLabel !== undefined ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: c.primarySoft },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          accessibilityIgnoresInvertColors
          onError={() => setFailed(true)}
          style={{ width: d, height: d }}
        />
      ) : (
        <Text
          variant="bodyStrong"
          color="primary"
          style={{ fontSize: FONT[size], lineHeight: FONT[size] + 4, fontFamily: fonts.bold }}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // El centrado es del monograma dentro del círculo.
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
