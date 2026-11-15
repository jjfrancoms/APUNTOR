import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { auth } from '@/theme/tokens';

/**
 * Fondo de las pantallas de acceso: teal profundo con brillos suaves y curvas de luz en las
 * esquinas. Es estático (sin animación, así que no hay nada que reducir) y está dibujado con
 * SVG para verse igual en web y en el teléfono. Excepción aprobada en DESIGN.md.
 */
export function AuthBackground() {
  const { width: w, height: h } = useWindowDimensions();
  const reach = Math.max(w, h);
  // Curvas de las esquinas: un relleno apenas visible y un trazo fino de luz.
  const topLeft = `M ${w * 0.3} 0 C ${w * 0.42} ${h * 0.1}, ${w * 0.3} ${h * 0.2}, 0 ${h * 0.32}`;
  const bottomLeft = `M 0 ${h * 0.78} C ${w * 0.1} ${h * 0.86}, ${w * 0.18} ${h * 0.95}, ${w * 0.24} ${h}`;
  const bottomRight = `M ${w} ${h * 0.8} C ${w * 0.9} ${h * 0.86}, ${w * 0.82} ${h * 0.94}, ${w * 0.76} ${h}`;
  const bottomRightInner = `M ${w} ${h * 0.86} C ${w * 0.93} ${h * 0.9}, ${w * 0.88} ${h * 0.96}, ${w * 0.84} ${h}`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <RadialGradient
            id="g-tl"
            cx={w * 0.1}
            cy={h * 0.08}
            r={reach * 0.6}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={auth.glow} stopOpacity={0.55} />
            <Stop offset="1" stopColor={auth.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="g-card"
            cx={w * 0.72}
            cy={h * 0.5}
            r={reach * 0.42}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={auth.glow} stopOpacity={0.32} />
            <Stop offset="1" stopColor={auth.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="g-bl"
            cx={w * 0.04}
            cy={h}
            r={reach * 0.55}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={auth.glowSoft} stopOpacity={0.3} />
            <Stop offset="1" stopColor={auth.glowSoft} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="g-br" cx={w} cy={h} r={reach * 0.5} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={auth.glow} stopOpacity={0.5} />
            <Stop offset="1" stopColor={auth.glow} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="g-shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.6" stopColor={auth.bgDeep} stopOpacity={0} />
            <Stop offset="1" stopColor={auth.bgDeep} stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect width={w} height={h} fill={auth.bg} />
        <Rect width={w} height={h} fill="url(#g-card)" />
        <Rect width={w} height={h} fill="url(#g-tl)" />
        <Rect width={w} height={h} fill="url(#g-bl)" />
        <Rect width={w} height={h} fill="url(#g-br)" />
        <Rect width={w} height={h} fill="url(#g-shade)" />
        <Path d={`${topLeft} L 0 0 Z`} fill={auth.glowSoft} fillOpacity={0.07} />
        <Path
          d={topLeft}
          stroke={auth.glowSoft}
          strokeOpacity={0.28}
          strokeWidth={1.5}
          fill="none"
        />
        <Path d={`${bottomLeft} L 0 ${h} Z`} fill={auth.glow} fillOpacity={0.22} />
        <Path
          d={bottomLeft}
          stroke={auth.glowSoft}
          strokeOpacity={0.35}
          strokeWidth={1.5}
          fill="none"
        />
        <Path d={`${bottomRight} L ${w} ${h} Z`} fill={auth.glow} fillOpacity={0.2} />
        <Path
          d={bottomRight}
          stroke={auth.glowSoft}
          strokeOpacity={0.4}
          strokeWidth={1.5}
          fill="none"
        />
        <Path
          d={bottomRightInner}
          stroke={auth.glowSoft}
          strokeOpacity={0.22}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
    </View>
  );
}
