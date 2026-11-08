import { describe, expect, it } from 'vitest';
import {
  HIGH_THINKING_BUDGET,
  LOW_THINKING_BUDGET,
  MEDIUM_THINKING_BUDGET,
  resolveModels,
} from '../../api/src/llm/models';
import { GENERATION_MODEL } from '../../api/src/llm/vertex';

describe('resolveModels', () => {
  it('sin variables, todo usa el modelo por defecto', () => {
    expect(resolveModels({})).toEqual({
      low: GENERATION_MODEL,
      medium: GENERATION_MODEL,
      high: GENERATION_MODEL,
      chat: GENERATION_MODEL,
      summary: GENERATION_MODEL,
      ocr: GENERATION_MODEL,
    });
  });

  it('GENERATION_MODEL sirve de base para los tres niveles', () => {
    const models = resolveModels({ GENERATION_MODEL: 'gemini-3.8-flash' });
    expect(models.low).toBe('gemini-3.8-flash');
    expect(models.medium).toBe('gemini-3.8-flash');
    expect(models.high).toBe('gemini-3.8-flash');
  });

  it('bajo, medio y alto: medio para el chat, alto para OCR y resúmenes', () => {
    expect(
      resolveModels({
        MODEL_LOW: 'bajo',
        MODEL_MEDIUM: 'medio',
        MODEL_HIGH: 'alto',
        GENERATION_MODEL: 'otro',
      }),
    ).toEqual({
      low: 'bajo',
      medium: 'medio',
      high: 'alto',
      chat: 'medio',
      summary: 'alto',
      ocr: 'alto',
    });
  });

  it('el nivel bajo es el medio si no se indica', () => {
    expect(resolveModels({ MODEL_MEDIUM: 'medio' }).low).toBe('medio');
  });

  it('compatibilidad: MODEL_FAST hace de medio y MODEL_STRONG de alto', () => {
    const models = resolveModels({ MODEL_FAST: 'rapido', MODEL_STRONG: 'fuerte' });
    expect(models).toMatchObject({ medium: 'rapido', high: 'fuerte', low: 'rapido' });
  });

  it('MODEL_MEDIUM y MODEL_HIGH tienen prioridad sobre los nombres antiguos', () => {
    const models = resolveModels({
      MODEL_MEDIUM: 'medio',
      MODEL_FAST: 'rapido',
      MODEL_HIGH: 'alto',
      MODEL_STRONG: 'fuerte',
    });
    expect(models).toMatchObject({ medium: 'medio', high: 'alto' });
  });

  it('CHAT_MODEL hace de medio si no hay MODEL_MEDIUM ni MODEL_FAST', () => {
    const models = resolveModels({ CHAT_MODEL: 'lite', GENERATION_MODEL: 'flash' });
    expect(models.medium).toBe('lite');
    expect(models.chat).toBe('lite');
    expect(models.high).toBe('flash');
  });

  it('CHAT_MODEL y SUMMARY_MODEL son ajustes más específicos', () => {
    const models = resolveModels({
      MODEL_MEDIUM: 'medio',
      MODEL_HIGH: 'alto',
      CHAT_MODEL: 'chat',
      SUMMARY_MODEL: 'resumen',
    });
    expect(models).toEqual({
      low: 'medio',
      medium: 'medio',
      high: 'alto',
      chat: 'chat',
      summary: 'resumen',
      ocr: 'alto',
    });
  });
});

describe('presupuestos de razonamiento', () => {
  it('bajo 512, medio 1024 y alto sin tope; nunca 0', () => {
    expect(LOW_THINKING_BUDGET).toBe(512);
    expect(MEDIUM_THINKING_BUDGET).toBe(1024);
    expect(HIGH_THINKING_BUDGET).toBeUndefined();
    for (const budget of [LOW_THINKING_BUDGET, MEDIUM_THINKING_BUDGET]) {
      expect(budget).toBeGreaterThan(0);
    }
  });
});
