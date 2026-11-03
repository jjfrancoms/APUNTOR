import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useStrings } from '@/i18n/es';
import { mascotPalette, useTheme } from '@/theme';

export type MascotMood = 'happy' | 'curious' | 'surprised' | 'sleepy' | 'worried' | 'sparkle';

/**
 * Illari (provisional, SVG estático). En el MVP se reemplaza por la animación
 * Rive de 7 estados; mantiene la misma API (`mood`, `size`, `halo`).
 */
export function Mascot({
  size = 120,
  mood = 'happy',
  halo = false,
}: {
  size?: number;
  mood?: MascotMood;
  halo?: boolean;
}) {
  const { c } = useTheme();
  const s = useStrings();
  const { fur, furLight, inner, nose, ink, shine, tear, scarf, sparkle, sleep } = mascotPalette;
  const mouth =
    mood === 'surprised' ? (
      <Ellipse cx="50" cy="66" rx="3" ry="3.6" fill={nose} />
    ) : (
      <Path
        d="M46 63 Q50 67 54 63"
        stroke={nose}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    );
  const art = (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      accessibilityLabel={s.mascot.label}
      accessibilityRole="image"
    >
      <Ellipse cx="34" cy="22" rx="7" ry="16" fill={fur} transform="rotate(-12 34 22)" />
      <Ellipse cx="66" cy="22" rx="7" ry="16" fill={fur} transform="rotate(12 66 22)" />
      <Ellipse cx="34" cy="23" rx="3.5" ry="10" fill={inner} transform="rotate(-12 34 23)" />
      <Ellipse cx="66" cy="23" rx="3.5" ry="10" fill={inner} transform="rotate(12 66 23)" />
      <Ellipse cx="50" cy="56" rx="27" ry="26" fill={fur} />
      <Ellipse cx="50" cy="35" rx="15" ry="8" fill={furLight} />
      <Ellipse cx="50" cy="63" rx="13" ry="10" fill={furLight} />
      {mood === 'sleepy' ? (
        <>
          <Path
            d="M36 52 Q40 55 44 52"
            stroke={ink}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M56 52 Q60 55 64 52"
            stroke={ink}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Circle cx="40" cy="52" r={mood === 'surprised' ? 3.6 : 3.2} fill={ink} />
          <Circle cx="60" cy="52" r={mood === 'surprised' ? 3.6 : 3.2} fill={ink} />
          <Circle cx="41" cy="51" r="1" fill={shine} />
          <Circle cx="61" cy="51" r="1" fill={shine} />
        </>
      )}
      {mood === 'worried' ? (
        <>
          <Path d="M35 47 L44 44" stroke={nose} strokeWidth="1.6" strokeLinecap="round" />
          <Path d="M65 47 L56 44" stroke={nose} strokeWidth="1.6" strokeLinecap="round" />
          <Path d="M79 30 Q76 36 79 38 Q82 36 79 30 Z" fill={tear} />
        </>
      ) : null}
      <Ellipse cx="33" cy="61" rx="4" ry="2.6" fill={inner} opacity={0.8} />
      <Ellipse cx="67" cy="61" rx="4" ry="2.6" fill={inner} opacity={0.8} />
      <Ellipse cx="50" cy="58.5" rx="2.6" ry="1.8" fill={nose} />
      {mouth}
      <Rect x="30" y="78" width="40" height="9" rx="4.5" fill={scarf} />
      {mood === 'sleepy' ? (
        <Path
          d="M74 14 h7 l-7 8 h7 M84 6 h5 l-5 6 h5"
          stroke={scarf}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {mood === 'sparkle' ? (
        <>
          <Path d="M14 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill={sparkle} />
          <Path d="M86 22 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill={sparkle} />
          <Path d="M84 62 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1 Z" fill={sparkle} />
        </>
      ) : null}
      {mood === 'curious' ? (
        <>
          <Circle cx="80" cy="18" r="3" fill={sleep} />
          <Circle cx="87" cy="11" r="2" fill={sleep} />
        </>
      ) : null}
    </Svg>
  );
  if (!halo) return art;
  const d = size * 1.3;
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {art}
    </View>
  );
}
