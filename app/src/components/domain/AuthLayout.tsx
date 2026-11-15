import type { ReactNode } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { BrandLogo, Screen, Text } from '@/components/ui';
import { useStrings } from '@/i18n/es';
import { AuthTheme, fonts, radius, space, useTheme, useWide } from '@/theme';
import { auth } from '@/theme/tokens';
import { AuthBackground } from './AuthBackground';

// Ilustración 3D de Illari (660×792, fondo transparente). Solo se usa en las pantallas de acceso.
const LLAMA = require('../../../assets/brand/illari-3d-web.png') as number;
const LLAMA_RATIO = 660 / 792;

/**
 * Marco de las pantallas de acceso (inicio de sesión, registro, recuperación, privacidad…).
 * Usa su propia paleta teal fija (`AuthTheme`), igual con el tema claro y con el oscuro.
 * - Ancho (≥ 600 px): dos columnas. A la izquierda la marca (logo, título, frase de apoyo)
 *   con la ilustración 3D de Illari abajo; a la derecha, el formulario en una tarjeta
 *   de borde luminoso.
 * - Teléfono: una columna. Logo y título arriba (con Illari pequeña si `phoneIllari`) y el
 *   formulario en la tarjeta.
 * El pie (botones fijos) va dentro de la tarjeta en ancho; en el teléfono queda fijo al pie.
 * El brillo, el degradado, el borde luminoso y las curvas del fondo son una
 * excepción aprobada para estas pantallas (ver DESIGN.md); no se usan en el resto de la app.
 */
export function AuthLayout(props: AuthLayoutProps) {
  return (
    <AuthTheme>
      <AuthFrame {...props} />
    </AuthTheme>
  );
}

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  /** Palabra del título que va en el color de acento (p. ej. «apuntes»). */
  highlight?: string;
  /** Título de la tarjeta del formulario. Sin valor, la tarjeta solo lleva el formulario. */
  cardTitle?: string;
  cardSubtitle?: string;
  /** En el teléfono, muestra a Illari pequeña junto al título (solo en pantallas cortas). */
  phoneIllari?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

function AuthFrame({
  title,
  subtitle,
  highlight,
  cardTitle,
  cardSubtitle,
  phoneIllari = false,
  header,
  footer,
  children,
}: AuthLayoutProps) {
  const wide = useWide();
  const { width, height } = useWindowDimensions();
  const heroSize = wide ? Math.round(Math.min(46, Math.max(32, width * 0.034))) : 28;
  const heading = (
    <View style={styles.heading}>
      <Text
        variant="display"
        accessibilityRole="header"
        style={{
          fontSize: heroSize,
          lineHeight: Math.round(heroSize * 1.12),
          // Ancho acotado: «Estudia con tus / propios apuntes» en dos líneas, como en el diseño.
          maxWidth: wide ? Math.round(heroSize * 10.5) : undefined,
        }}
      >
        <HighlightedTitle title={title} highlight={highlight} size={heroSize} />
      </Text>
      {/* En el teléfono, con título de tarjeta, la frase larga se omite para que el formulario suba. */}
      {subtitle && (wide || !cardTitle) ? (
        <Text variant="lead" color="textMuted" style={styles.lead}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
  const card = (
    <AuthCard compact={!wide}>
      {cardTitle ? (
        <View style={styles.cardHeading}>
          <Text variant="title" accessibilityRole="header">
            {cardTitle}
          </Text>
          {cardSubtitle ? (
            <Text variant="body" color="textMuted">
              {cardSubtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
      {wide && footer ? <View style={styles.footer}>{footer}</View> : null}
    </AuthCard>
  );

  if (!wide) {
    return (
      <Screen header={header} footer={footer} background={<AuthBackground />}>
        <View style={styles.phone}>
          <BrandLogo variant="horizontal" size={24} />
          <View style={styles.phoneHero}>
            <View style={styles.flex}>{heading}</View>
            {phoneIllari ? <Illari height={112} /> : null}
          </View>
          {card}
        </View>
      </Screen>
    );
  }
  // La ilustración mide ~400 px en escritorio y se reduce en tablet.
  const llamaHeight = Math.round(Math.min(410, Math.max(240, width * 0.36)));
  return (
    <Screen wide header={header} background={<AuthBackground />}>
      <View style={[styles.columns, { minHeight: Math.max(560, height - 150) }]}>
        <View style={styles.brand}>
          <View style={styles.brandTop}>
            <BrandLogo variant="horizontal" size={34} />
            {heading}
          </View>
          <Illari height={llamaHeight} glow />
        </View>
        <View style={styles.formColumn}>{card}</View>
      </View>
    </Screen>
  );
}

/** Título con una palabra en el color de acento. El nombre accesible sigue siendo el título entero. */
function HighlightedTitle({
  title,
  highlight,
  size,
}: {
  title: string;
  highlight?: string;
  size: number;
}) {
  const at = highlight ? title.lastIndexOf(highlight) : -1;
  if (!highlight || at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <Text
        variant="display"
        color="primary"
        style={{ fontSize: size, lineHeight: Math.round(size * 1.12) }}
      >
        {highlight}
      </Text>
      {title.slice(at + highlight.length)}
    </>
  );
}

/** Tarjeta del formulario: superficie teal, borde luminoso con resplandor y una curva de luz arriba a la derecha. */
function AuthCard({ compact, children }: { compact: boolean; children: ReactNode }) {
  return (
    <View style={[styles.card, compact ? styles.cardCompact : styles.cardRegular]}>
      <Svg style={styles.cardCurve} width={150} height={120} aria-hidden>
        <Path d="M 0 0 C 62 8, 118 44, 150 112 L 150 0 Z" fill={auth.glowSoft} fillOpacity={0.14} />
        <Path
          d="M 0 0 C 62 8, 118 44, 150 112"
          stroke={auth.glowSoft}
          strokeOpacity={0.55}
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}

/** Illari en 3D con dimensiones fijas (sin saltos al cargar) y, opcionalmente, un brillo teal bajo ella. */
function Illari({ height, glow = false }: { height: number; glow?: boolean }) {
  const width = Math.round(height * LLAMA_RATIO);
  const glowWidth = Math.round(width * 1.25);
  const glowHeight = Math.round(height * 0.22);
  return (
    <View style={{ width: glowWidth, height }} pointerEvents="none">
      {glow ? (
        <Svg
          style={[styles.llamaGlow, { left: 0 }]}
          width={glowWidth}
          height={glowHeight}
          aria-hidden
        >
          <Defs>
            <RadialGradient id="llama-glow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={auth.glowSoft} stopOpacity={0.55} />
              <Stop offset="1" stopColor={auth.glowSoft} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={glowWidth / 2}
            cy={glowHeight / 2}
            rx={glowWidth / 2}
            ry={glowHeight / 2}
            fill="url(#llama-glow)"
          />
        </Svg>
      ) : null}
      <Image
        source={LLAMA}
        accessibilityLabel="Illari"
        resizeMode="contain"
        style={{ width, height, marginLeft: Math.round((glowWidth - width) / 2) }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  heading: { gap: space.md },
  lead: { maxWidth: 480 },
  phone: { gap: space.xl, paddingTop: space.md, paddingBottom: space.md },
  phoneHero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  columns: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.xxxl,
    paddingTop: space.xl,
    paddingBottom: space.xl,
  },
  brand: { flex: 1, minWidth: 0, justifyContent: 'space-between', gap: space.xl },
  brandTop: { gap: space.xxl, alignItems: 'flex-start' },
  formColumn: { flex: 1, minWidth: 300, maxWidth: 540, justifyContent: 'center' },
  card: {
    backgroundColor: auth.card,
    borderColor: auth.cardBorder,
    borderWidth: 1,
    borderRadius: 28,
    overflow: 'hidden',
    gap: space.lg,
    boxShadow: `0 0 56px 0 ${auth.cardGlow}`,
  },
  cardRegular: { padding: space.xxxl },
  cardCompact: { padding: space.xl, borderRadius: radius.xl + 4 },
  cardCurve: { position: 'absolute', top: 0, right: 0 },
  cardHeading: { gap: space.xs, paddingBottom: space.xs },
  footer: { gap: space.sm, paddingTop: space.sm },
  llamaGlow: { position: 'absolute', bottom: 0 },
});
