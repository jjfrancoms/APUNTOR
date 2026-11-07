import { describe, expect, it } from 'vitest';
import { toErrorMessage } from '../../worker/src/ingestion/queue-worker';

describe('motivo de error guardado', () => {
  it('no guarda la respuesta cruda del proveedor de IA', () => {
    const raw = new Error('{"error":{"code":429,"message":"You exceeded your current quota"}}');
    expect(toErrorMessage(raw)).toMatch(/^AI_RATE_LIMIT/u);
    expect(toErrorMessage(new Error('{"error":{"code":400}}'))).toMatch(/^AI_ERROR/u);
  });

  it('conserva mensajes propios, recortados', () => {
    expect(toErrorMessage(new Error('El PDF no tiene texto'))).toBe('El PDF no tiene texto');
    expect(toErrorMessage(new Error('x'.repeat(900)))).toHaveLength(300);
  });
});
