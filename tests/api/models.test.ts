import { describe, expect, it } from 'vitest';
import { resolveModels } from '../../api/src/llm/models';
import { GENERATION_MODEL } from '../../api/src/llm/vertex';

describe('resolveModels', () => {
  it('sin variables, todo usa el modelo por defecto', () => {
    expect(resolveModels({})).toEqual({
      fast: GENERATION_MODEL,
      strong: GENERATION_MODEL,
      chat: GENERATION_MODEL,
      summary: GENERATION_MODEL,
      ocr: GENERATION_MODEL,
    });
  });

  it('GENERATION_MODEL sirve de base para ambos', () => {
    const models = resolveModels({ GENERATION_MODEL: 'gemini-3.8-flash' });
    expect(models.fast).toBe('gemini-3.8-flash');
    expect(models.strong).toBe('gemini-3.8-flash');
  });

  it('rápido para el chat y fuerte para OCR y resúmenes', () => {
    expect(
      resolveModels({
        MODEL_FAST: 'gemini-flash-lite-latest',
        MODEL_STRONG: 'gemini-3.8-flash',
        GENERATION_MODEL: 'otro',
      }),
    ).toEqual({
      fast: 'gemini-flash-lite-latest',
      strong: 'gemini-3.8-flash',
      chat: 'gemini-flash-lite-latest',
      summary: 'gemini-3.8-flash',
      ocr: 'gemini-3.8-flash',
    });
  });

  it('CHAT_MODEL hace de rápido si no hay MODEL_FAST', () => {
    const models = resolveModels({ CHAT_MODEL: 'lite', GENERATION_MODEL: 'flash' });
    expect(models.fast).toBe('lite');
    expect(models.chat).toBe('lite');
    expect(models.strong).toBe('flash');
  });

  it('CHAT_MODEL y SUMMARY_MODEL son ajustes más específicos', () => {
    const models = resolveModels({
      MODEL_FAST: 'rapido',
      MODEL_STRONG: 'fuerte',
      CHAT_MODEL: 'chat',
      SUMMARY_MODEL: 'resumen',
    });
    expect(models).toEqual({
      fast: 'rapido',
      strong: 'fuerte',
      chat: 'chat',
      summary: 'resumen',
      ocr: 'fuerte',
    });
  });
});
