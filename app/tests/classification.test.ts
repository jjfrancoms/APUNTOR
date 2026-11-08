import { describe, expect, it } from 'vitest';
import { confidenceLevel } from '../src/lib/classification';

describe('confianza de la clasificación', () => {
  it('Alta desde 0,75, Media desde 0,45 y Baja por debajo', () => {
    expect(confidenceLevel(0.75)).toBe('high');
    expect(confidenceLevel(0.9)).toBe('high');
    expect(confidenceLevel(0.74)).toBe('medium');
    expect(confidenceLevel(0.45)).toBe('medium');
    expect(confidenceLevel(0.44)).toBe('low');
    expect(confidenceLevel(0)).toBe('low');
  });
  it('sin dato cuenta como Baja', () => {
    expect(confidenceLevel(null)).toBe('low');
  });
});
