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

describe('fecha de nacimiento', async () => {
  const { ageOn, formatBirthInput, parseBirthDate } = await import('../src/lib/validation');
  const today = new Date(2026, 10, 3);
  it('formatea mientras se escribe', () => {
    expect(formatBirthInput('1')).toBe('1');
    expect(formatBirthInput('1503')).toBe('15/03');
    expect(formatBirthInput('15032008x9')).toBe('15/03/2008');
  });
  it('rechaza fechas imposibles, futuras o mal escritas', () => {
    expect(parseBirthDate('31/02/2000', today)).toBeNull();
    expect(parseBirthDate('01/01/2030', today)).toBeNull();
    expect(parseBirthDate('1/1/2000', today)).toBeNull();
    expect(parseBirthDate('15/03/2000', today)).not.toBeNull();
  });
  it('calcula la edad respetando si ya pasó el cumpleaños', () => {
    expect(ageOn(new Date(2008, 10, 3), today)).toBe(18);
    expect(ageOn(new Date(2008, 10, 4), today)).toBe(17);
  });
});
