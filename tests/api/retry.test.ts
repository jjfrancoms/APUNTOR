import { describe, expect, it, vi } from 'vitest';
import {
  isTransientAiError,
  suggestedDelayMs,
  withAiRetry,
  withRetries,
  type RetryPolicy,
} from '../../api/src/llm/retry';
import type { GenAiModels } from '../../api/src/llm/vertex';

const QUOTA_ERROR = new Error(
  '{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED","details":[{"retryDelay":"17s"}]}}',
);
const POLICY: RetryPolicy = { attempts: 3, baseDelayMs: 1000, maxDelayMs: 10_000 };

describe('reintentos ante límites de la IA', () => {
  it('reconoce 429 y 503, no otros errores', () => {
    expect(isTransientAiError(QUOTA_ERROR)).toBe(true);
    expect(isTransientAiError(Object.assign(new Error('x'), { status: 503 }))).toBe(true);
    expect(isTransientAiError(new Error('{"error":{"code":400,"message":"bad"}}'))).toBe(false);
    expect(isTransientAiError(new Error('PDF dañado'))).toBe(false);
  });

  it('lee la espera que sugiere Google', () => {
    expect(suggestedDelayMs(QUOTA_ERROR)).toBe(17_000);
    expect(suggestedDelayMs(new Error('sin pista'))).toBeNull();
  });

  it('reintenta y respeta la espera sugerida con tope', async () => {
    const wait = vi.fn(() => Promise.resolve());
    const op = vi.fn().mockRejectedValueOnce(QUOTA_ERROR).mockResolvedValueOnce('ok');
    await expect(withAiRetry(op, POLICY, wait)).resolves.toBe('ok');
    expect(wait).toHaveBeenCalledWith(10_000);
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('usa espera exponencial sin pista y se rinde al agotar intentos', async () => {
    const wait = vi.fn(() => Promise.resolve());
    const error = Object.assign(new Error('saturado'), { status: 503 });
    const op = vi.fn().mockRejectedValue(error);
    await expect(withAiRetry(op, POLICY, wait)).rejects.toBe(error);
    expect(op).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[1000], [2000]]);
  });

  it('no reintenta errores permanentes', async () => {
    const wait = vi.fn(() => Promise.resolve());
    const op = vi.fn().mockRejectedValue(new Error('PDF dañado'));
    await expect(withAiRetry(op, POLICY, wait)).rejects.toThrow('PDF dañado');
    expect(op).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('envuelve embeddings y generación', async () => {
    const wait = vi.fn(() => Promise.resolve());
    const models = {
      embedContent: vi
        .fn()
        .mockRejectedValueOnce(QUOTA_ERROR)
        .mockResolvedValueOnce({ embeddings: [] }),
      generateContent: vi
        .fn()
        .mockRejectedValueOnce(QUOTA_ERROR)
        .mockResolvedValueOnce({ text: '{}' }),
    } as unknown as GenAiModels;
    const wrapped = withRetries(models, POLICY, wait);
    await wrapped.embedContent({
      model: 'm',
      contents: [],
      config: { outputDimensionality: 768 },
    });
    await wrapped.generateContent({
      model: 'm',
      contents: [],
      config: { systemInstruction: '', temperature: 0 },
    });
    expect(wait).toHaveBeenCalledTimes(2);
  });
});
