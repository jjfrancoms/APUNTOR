import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/src/errors';
import { answerQuestion } from '../../api/src/rag/answer';
import { ABSTENTION_MESSAGE } from '../../api/src/rag/retriever';
import { CHUNK, fakeEmbedder, fakeGenerator, fakeQuota, VALID_ANSWER } from './helpers';

const USER = '11111111-1111-4111-8111-111111111111';

describe('answerQuestion', () => {
  it('responde con la cita validada y cuenta la pregunta', async () => {
    const quota = fakeQuota();
    const result = await answerQuestion(
      {
        embedder: fakeEmbedder,
        search: () => Promise.resolve([CHUNK]),
        generator: fakeGenerator(VALID_ANSWER),
        quota,
      },
      { userId: USER, question: '¿Qué produce la mitocondria?' },
    );
    expect(result.status).toBe('answered');
    if (result.status === 'answered') {
      expect(result.claims[0]?.citations[0]?.pageNumber).toBe(12);
    }
    expect(quota.used).toBe(1);
  });

  it('sin coincidencias se abstiene sin llamar al LLM y no cuenta la pregunta', async () => {
    const quota = fakeQuota();
    const generator = fakeGenerator(VALID_ANSWER);
    const result = await answerQuestion(
      { embedder: fakeEmbedder, search: () => Promise.resolve([]), generator, quota },
      { userId: USER, question: '¿Quién ganó el Mundial?' },
    );
    expect(result).toEqual({
      status: 'abstained',
      message: ABSTENTION_MESSAGE,
      reason: 'no_matches',
    });
    expect(generator.calls).toBe(0);
    expect(quota.used).toBe(0);
  });

  it('una respuesta que no pasa el validador se convierte en abstención', async () => {
    const invented = JSON.stringify({
      answer_found: true,
      claims: [{ text: 'Dato inventado.', citations: [{ fragment_id: 'x', quote: 'a b c' }] }],
    });
    const result = await answerQuestion(
      {
        embedder: fakeEmbedder,
        search: () => Promise.resolve([CHUNK]),
        generator: fakeGenerator(invented),
        quota: fakeQuota(),
      },
      { userId: USER, question: '¿Qué produce la mitocondria?' },
    );
    expect(result).toMatchObject({
      status: 'abstained',
      reason: 'validation_failed',
      detail: 'unknown_fragment',
    });
  });

  it('devuelve la pregunta a la cuota si el LLM falla', async () => {
    const quota = fakeQuota();
    await expect(
      answerQuestion(
        {
          embedder: fakeEmbedder,
          search: () => Promise.resolve([CHUNK]),
          generator: { generateJson: () => Promise.reject(new Error('503')) },
          quota,
        },
        { userId: USER, question: '¿Qué produce la mitocondria?' },
      ),
    ).rejects.toThrow('503');
    expect(quota.used).toBe(0);
  });

  it('corta con CHAT_DAILY_LIMIT al agotar la cuota, antes de gastar en el modelo', async () => {
    const generator = fakeGenerator(VALID_ANSWER);
    const promise = answerQuestion(
      {
        embedder: fakeEmbedder,
        search: () => Promise.resolve([CHUNK]),
        generator,
        quota: fakeQuota(0),
      },
      { userId: USER, question: 'x' },
    );
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ code: 'CHAT_DAILY_LIMIT' });
    expect(generator.calls).toBe(0);
  });
});
