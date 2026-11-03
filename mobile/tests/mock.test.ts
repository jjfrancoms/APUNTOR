import { describe, expect, it } from 'vitest';
import { continueLearning, courses, topics } from '../src/data/mock';
import { es } from '../src/i18n/es';

describe('datos de ejemplo', () => {
  it('los progresos están en [0, 1]', () => {
    for (const course of courses) {
      expect(course.progress).toBeGreaterThanOrEqual(0);
      expect(course.progress).toBeLessThanOrEqual(1);
      for (const k of course.classes) expect(k.progress).toBeGreaterThanOrEqual(0);
    }
  });

  it('"Continúa donde lo dejaste" apunta a un tema existente', () => {
    expect(topics[continueLearning.topicId]).toBeDefined();
  });

  it('el contexto externo siempre trae fuente', () => {
    for (const t of Object.values(topics)) {
      if (t.external) expect(t.external.source.length).toBeGreaterThan(0);
    }
  });
});

describe('textos', () => {
  it('incluye todos los códigos de error de la especificación transcritos', () => {
    expect(Object.keys(es.errors)).toEqual(
      expect.arrayContaining([
        'AUTH_EMAIL_TAKEN',
        'AUTH_INVALID',
        'AUTH_LINK_EXPIRED',
        'AUTH_WEAK_PASSWORD',
        'UP_FORMAT',
        'UP_NETWORK',
        'UP_QUOTA',
        'UP_SIZE',
      ]),
    );
  });

  it('los códigos de error siguen el formato AREA_MOTIVO en mayúsculas', () => {
    for (const code of Object.keys(es.errors)) expect(code).toMatch(/^[A-Z]+(_[A-Z]+)+$/u);
  });
});
