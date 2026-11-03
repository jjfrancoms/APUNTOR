import { describe, expect, it } from 'vitest';
import { formatCountdown, formatPercent } from '../src/lib/format';
import { splitMatch } from '../src/lib/text';
import { isValidEmail, isWeakPassword, MIN_PASSWORD_LENGTH } from '../src/lib/validation';

describe('formatCountdown', () => {
  it.each([
    [42, '0:42'],
    [75, '1:15'],
    [0, '0:00'],
    [-3, '0:00'],
  ])('%i s → %s', (s, out) => expect(formatCountdown(s)).toBe(out));
});

describe('formatPercent', () => {
  it('usa espacio antes del signo y limita a [0, 100]', () => {
    expect(formatPercent(0.654)).toBe('65 %');
    expect(formatPercent(1.4)).toBe('100 %');
    expect(formatPercent(-1)).toBe('0 %');
  });
});

describe('validación (AUTH_WEAK_PASSWORD)', () => {
  it('exige al menos 8 caracteres', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(isWeakPassword('1234567')).toBe(true);
    expect(isWeakPassword('12345678')).toBe(false);
  });
  it('valida correos', () => {
    expect(isValidEmail('ana@correo.com')).toBe(true);
    expect(isValidEmail('ana@correo')).toBe(false);
  });
});

describe('splitMatch', () => {
  it('marca coincidencias sin distinguir mayúsculas y conserva el texto original', () => {
    const parts = splitMatch('El Límite lateral y otro límite lateral.', 'límite lateral');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual([
      'Límite lateral',
      'límite lateral',
    ]);
    expect(parts.map((p) => p.text).join('')).toBe('El Límite lateral y otro límite lateral.');
  });
  it('sin consulta devuelve el texto completo sin marcar', () => {
    expect(splitMatch('abc', '')).toEqual([{ text: 'abc', hit: false }]);
  });
});
