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

describe('precios', () => {
  it('el anual baja el precio mensual un 20 %', async () => {
    const { studentPrice, formatSoles } = await import('../src/lib/pricing');
    expect(formatSoles(studentPrice('monthly').perMonth)).toBe('S/ 14');
    const y = studentPrice('yearly');
    expect(formatSoles(y.perMonth)).toBe('S/ 11.20');
    expect(formatSoles(y.total)).toBe('S/ 134.40');
    expect(formatSoles(y.savedPerYear ?? 0)).toBe('S/ 33.60');
  });
});

describe('idiomas', () => {
  it('inglés tiene las mismas claves que español, sin textos vacíos', async () => {
    const { es } = await import('../src/i18n/es');
    const { en } = await import('../src/i18n/en');
    const walk = (a: unknown, b: unknown, path: string): string[] => {
      if (typeof a === 'string')
        return typeof b === 'string' && (b.length > 0 || a.length === 0) ? [] : [path];
      if (typeof a === 'function') return typeof b === 'function' ? [] : [path];
      if (a && typeof a === 'object') {
        if (!b || typeof b !== 'object') return [path];
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        return [...keys].flatMap((k) =>
          walk(
            (a as Record<string, unknown>)[k],
            (b as Record<string, unknown>)[k],
            `${path}.${k}`,
          ),
        );
      }
      return a === b || typeof a === typeof b ? [] : [path];
    };
    expect(walk(es, en, 'es')).toEqual([]);
  });
});

describe('calendario', () => {
  it('arma el mes empezando el lunes, en filas de 7', async () => {
    const { monthGrid, daysInMonth, formatDayMonthYear, yearRange } =
      await import('../src/lib/calendar');
    // 1 de noviembre de 2026 es domingo → 6 huecos antes.
    const nov = monthGrid(2026, 10);
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(nov.length % 7).toBe(0);
    expect(nov.filter((d) => d !== null)).toHaveLength(30);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(formatDayMonthYear(2000, 2, 5)).toBe('05/03/2000');
    expect(yearRange(2026, 2024)).toEqual([2026, 2025, 2024]);
  });
});

describe('nueva contraseña y enlaces de regreso', () => {
  it('pide 8+ caracteres y que se escriba dos veces igual', async () => {
    const { validateNewPassword } = await import('../src/lib/validation');
    expect(validateNewPassword('', '')).toBe('AUTH_WEAK_PASSWORD');
    expect(validateNewPassword('1234567', '1234567')).toBe('AUTH_WEAK_PASSWORD');
    expect(validateNewPassword('12345678', '12345679')).toBe('AUTH_PASSWORD_MISMATCH');
    expect(validateNewPassword('12345678', '12345678')).toBeNull();
  });

  it('lee el código y los errores de la URL de regreso', async () => {
    const { authParamsFromUrl } = await import('../src/lib/auth-url');
    expect(
      authParamsFromUrl('exp://192.168.1.20:8081/--/auth-callback?code=abc&sb_flow_id=f1'),
    ).toEqual({ code: 'abc', flowId: 'f1', error: null });
    expect(
      authParamsFromUrl(
        'http://localhost:8081/reset-password#error=access_denied&error_code=otp_expired',
      ),
    ).toEqual({ code: null, flowId: null, error: 'otp_expired' });
    expect(authParamsFromUrl('apuntor://auth-callback')).toEqual({
      code: null,
      flowId: null,
      error: null,
    });
  });
});
