import Svg, { G, Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import {
  HORIZONTAL_VIEWBOX,
  ISOTIPO_PATH,
  ISOTIPO_TRANSFORM,
  ISOTIPO_VIEWBOX,
  LETRAS_PATH,
  LETRAS_TRANSFORM,
} from './brandLogoPaths';

export type BrandLogoVariant = 'isotipo' | 'horizontal';

/**
 * Marca de APUNTOR (kit en docs/marca). El color sale del token `primary`, que coincide con
 * la variante `color` en claro y `oscuro` en oscuro. La mascota Illari es
 * el personaje; este componente es la marca. `size` es el alto en px (el ancho se calcula).
 */
export function BrandLogo({
  variant = 'isotipo',
  size = 32,
  accessibilityLabel = 'Apuntor',
}: {
  variant?: BrandLogoVariant;
  size?: number;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const box = variant === 'horizontal' ? HORIZONTAL_VIEWBOX : ISOTIPO_VIEWBOX;
  const width = (size * box.w) / box.h;
  return (
    <Svg
      width={width}
      height={size}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <G transform={ISOTIPO_TRANSFORM}>
        <Path d={ISOTIPO_PATH} fill={c.primary} fillRule="evenodd" />
      </G>
      {variant === 'horizontal' ? (
        <G transform={LETRAS_TRANSFORM}>
          <Path d={LETRAS_PATH} fill={c.primary} />
        </G>
      ) : null}
    </Svg>
  );
}
