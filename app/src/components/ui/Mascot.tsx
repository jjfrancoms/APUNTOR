import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useStrings } from '@/i18n/es';
import { mascotPalette, useTheme } from '@/theme';

export type MascotMood = 'happy' | 'curious' | 'surprised' | 'sleepy' | 'worried' | 'sparkle';

/**
 * Illari, una llama (provisional, SVG estático). En el MVP se reemplaza por la animación
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
      <Ellipse cx="50" cy="56.5" rx="3" ry="3.6" fill={nose} />
    ) : (
      // Labio partido: el rasgo que distingue a una llama de otros animales de orejas largas.
      <Path
        d="M50 50 V53.5 M44.5 54 Q47.5 57.5 50 53.5 Q52.5 57.5 55.5 54"
        stroke={nose}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
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
      {/* Pecho y cuello largos: dan la silueta de llama aunque el dibujo sea pequeño. */}
      <Ellipse cx="50" cy="97" rx="23" ry="15" fill={fur} />
      <Rect x="38" y="52" width="24" height="36" rx="10" fill={fur} />
      {/* Orejas en forma de plátano, curvadas hacia adentro y terminadas en punta. */}
      <Path d="M35 30 C27 24 24 12 29 3 C36 8 42 18 42 28 Z" fill={fur} />
      <Path d="M65 30 C73 24 76 12 71 3 C64 8 58 18 58 28 Z" fill={fur} />
      <Path d="M35.5 26 C31 21 29 14 30.5 9 C35 13 38.5 19 39 26 Z" fill={inner} />
      <Path d="M64.5 26 C69 21 71 14 69.5 9 C65 13 61.5 19 61 26 Z" fill={inner} />
      <Ellipse cx="50" cy="38" rx="19" ry="17" fill={fur} />
      {/* Copete de lana y hocico alargado. */}
      <Circle cx="43" cy="24" r="6" fill={furLight} />
      <Circle cx="57" cy="24" r="6" fill={furLight} />
      <Circle cx="50" cy="21" r="7" fill={furLight} />
      <Ellipse cx="50" cy="52" rx="12.5" ry="11" fill={furLight} />
      {mood === 'sleepy' ? (
        <>
          <Path
            d="M34 38 Q38 41 42 38"
            stroke={ink}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M58 38 Q62 41 66 38"
            stroke={ink}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Circle cx="38" cy="38" r={mood === 'surprised' ? 3.6 : 3.2} fill={ink} />
          <Circle cx="62" cy="38" r={mood === 'surprised' ? 3.6 : 3.2} fill={ink} />
          <Circle cx="39" cy="37" r="1" fill={shine} />
          <Circle cx="63" cy="37" r="1" fill={shine} />
        </>
      )}
      {mood === 'worried' ? (
        <>
          <Path d="M33 33 L42 30" stroke={nose} strokeWidth="1.6" strokeLinecap="round" />
          <Path d="M67 33 L58 30" stroke={nose} strokeWidth="1.6" strokeLinecap="round" />
          <Path d="M77 36 Q74 42 77 44 Q80 42 77 36 Z" fill={tear} />
        </>
      ) : null}
      <Ellipse cx="33" cy="46" rx="3.6" ry="2.4" fill={inner} opacity={0.8} />
      <Ellipse cx="67" cy="46" rx="3.6" ry="2.4" fill={inner} opacity={0.8} />
      <Ellipse cx="50" cy="48.5" rx="2.6" ry="1.8" fill={nose} />
      {mouth}
      <Rect x="33" y="70" width="34" height="8" rx="4" fill={scarf} />
      {mood === 'sleepy' ? (
        <Path
          d="M78 18 h7 l-7 8 h7 M88 8 h5 l-5 6 h5"
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
          <Circle cx="82" cy="22" r="3" fill={sleep} />
          <Circle cx="89" cy="14" r="2" fill={sleep} />
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
