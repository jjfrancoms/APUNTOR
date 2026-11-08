import { describe, expect, it } from 'vitest';
import { progressPhase } from '../src/components/chat/progress';

describe('avisos de progreso del chat', () => {
  it('al principio solo busca', () => {
    expect(progressPhase(0)).toBe('searching');
    expect(progressPhase(7_999)).toBe('searching');
  });

  it('entre 8 y 25 segundos avisa que las preguntas largas tardan', () => {
    expect(progressPhase(8_000)).toBe('longer');
    expect(progressPhase(25_000)).toBe('longer');
  });

  it('pasados 25 segundos ofrece detenerla', () => {
    expect(progressPhase(25_001)).toBe('slow');
    expect(progressPhase(89_000)).toBe('slow');
  });

  it('un reloj desfasado (negativo o inválido) no asusta', () => {
    expect(progressPhase(-500)).toBe('searching');
    expect(progressPhase(Number.NaN)).toBe('searching');
  });
});
