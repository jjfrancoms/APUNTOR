import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';

export type MascotMood = 'happy' | 'curious' | 'surprised';

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
  const fur = '#EAD9BD';
  const furLight = '#F6ECDC';
  const inner = '#F2B8B5';
  const mouth =
    mood === 'surprised' ? (
      <Ellipse cx="50" cy="66" rx="3" ry="3.6" fill="#5B3A2E" />
    ) : (
      <Path
        d="M46 63 Q50 67 54 63"
        stroke="#5B3A2E"
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
      accessibilityLabel="Illari, tu mascota"
      accessibilityRole="image"
    >
      <Ellipse cx="34" cy="22" rx="7" ry="16" fill={fur} transform="rotate(-12 34 22)" />
      <Ellipse cx="66" cy="22" rx="7" ry="16" fill={fur} transform="rotate(12 66 22)" />
      <Ellipse cx="34" cy="23" rx="3.5" ry="10" fill={inner} transform="rotate(-12 34 23)" />
      <Ellipse cx="66" cy="23" rx="3.5" ry="10" fill={inner} transform="rotate(12 66 23)" />
      <Ellipse cx="50" cy="56" rx="27" ry="26" fill={fur} />
      <Ellipse cx="50" cy="35" rx="15" ry="8" fill={furLight} />
      <Ellipse cx="50" cy="63" rx="13" ry="10" fill={furLight} />
      <Circle cx="40" cy="52" r={mood === 'surprised' ? 3.6 : 3.2} fill="#2B2B2E" />
      <Circle cx="60" cy="52" r={mood === 'surprised' ? 3.6 : 3.2} fill="#2B2B2E" />
      <Circle cx="41" cy="51" r="1" fill="#FFFFFF" />
      <Circle cx="61" cy="51" r="1" fill="#FFFFFF" />
      <Ellipse cx="33" cy="61" rx="4" ry="2.6" fill={inner} opacity={0.8} />
      <Ellipse cx="67" cy="61" rx="4" ry="2.6" fill={inner} opacity={0.8} />
      <Ellipse cx="50" cy="58.5" rx="2.6" ry="1.8" fill="#5B3A2E" />
      {mouth}
      <Rect x="30" y="78" width="40" height="9" rx="4.5" fill="#1D7568" />
      {mood === 'curious' ? (
        <>
          <Circle cx="80" cy="18" r="3" fill="#B5ADA2" />
          <Circle cx="87" cy="11" r="2" fill="#B5ADA2" />
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
