import { describe, expect, it } from 'vitest';
import {
  colors,
  contrastRatio,
  navigationLayoutFor,
  TEXT_PAIRS,
  type ColorMode,
} from '../src/theme/tokens';

const AA = 4.5;

describe('tokens de color', () => {
  for (const mode of ['light', 'dark'] as ColorMode[]) {
    it.each(TEXT_PAIRS.map(([fg, bg]) => [fg, bg]))(`[${mode}] %s sobre %s cumple AA`, (fg, bg) => {
      const palette = colors[mode];
      expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(AA);
    });
  }

  it('coincide con los contrastes documentados en la especificación', () => {
    const d = colors.dark;
    expect(contrastRatio(d.text, d.bg)).toBeCloseTo(16.5, 0);
    expect(contrastRatio(d.primary, d.bg)).toBeCloseTo(7.5, 0);
    expect(contrastRatio(d.onPrimary, d.primary)).toBeCloseTo(7.0, 0);
  });

  it('calcula el contraste de referencia (negro/blanco = 21:1)', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
});

describe('navigationLayoutFor', () => {
  it.each([
    [390, 'bottom-bar'],
    [599, 'bottom-bar'],
    [600, 'rail'],
    [768, 'rail'],
    [1023, 'rail'],
    [1024, 'sidebar'],
    [1440, 'sidebar'],
  ] as const)('%i px → %s', (width, expected) => {
    expect(navigationLayoutFor(width)).toBe(expected);
  });
});
