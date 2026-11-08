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

describe('pregunta detenida por el estudiante', () => {
  it('corta la IA y no descuenta la pregunta', async () => {
    const quota = fakeQuota();
    const stop = new AbortController();
    let signalSeen: AbortSignal | undefined;
    const generator = {
      generateJson(request: { signal?: AbortSignal }) {
        signalSeen = request.signal;
        stop.abort();
        return Promise.reject(new Error('aborted'));
      },
    };
    await expect(
      answerQuestion(
        {
          embedder: fakeEmbedder,
          search: () => Promise.resolve([CHUNK]),
          generator,
          quota,
        },
        { userId: USER, question: '¿Qué produce la mitocondria?', signal: stop.signal },
      ),
    ).rejects.toThrow('aborted');
    expect(signalSeen).toBe(stop.signal);
    expect(quota.used).toBe(0);
  });

  it('si ya estaba detenida, ni siquiera llama a la IA', async () => {
    const quota = fakeQuota();
    const stop = new AbortController();
    stop.abort();
    let called = false;
    await expect(
      answerQuestion(
        {
          embedder: fakeEmbedder,
          search: () => Promise.resolve([CHUNK]),
          generator: {
            generateJson: () => {
              called = true;
              return Promise.reject(new Error('no'));
            },
          },
          quota,
        },
        { userId: USER, question: '¿Qué produce la mitocondria?', signal: stop.signal },
      ),
    ).rejects.toThrow('detenida');
    expect(called).toBe(false);
    expect(quota.used).toBe(0);
  });
});

describe('modelo rápido con segundo intento en el fuerte', () => {
  const INVALID = JSON.stringify({
    answer_found: true,
    claims: [{ text: 'Dato inventado.', citations: [{ fragment_id: 'x', quote: 'a b c' }] }],
  });
  const base = {
    embedder: fakeEmbedder,
    search: () => Promise.resolve([CHUNK]),
  };
  const ask = { userId: USER, question: '¿Qué produce la mitocondria?' };

  it('si la rápida es válida, no llama a la fuerte', async () => {
    const quota = fakeQuota();
    const fallbackGenerator = fakeGenerator(VALID_ANSWER);
    const result = await answerQuestion(
      { ...base, generator: fakeGenerator(VALID_ANSWER), fallbackGenerator, quota },
      ask,
    );
    expect(result.status).toBe('answered');
    expect(fallbackGenerator.calls).toBe(0);
    expect(quota.used).toBe(1);
  });

  it('si la rápida no pasa el validador, responde la fuerte (una sola pregunta)', async () => {
    const quota = fakeQuota();
    const generator = fakeGenerator(INVALID);
    const fallbackGenerator = fakeGenerator(VALID_ANSWER);
    const result = await answerQuestion({ ...base, generator, fallbackGenerator, quota }, ask);
    expect(result.status).toBe('answered');
    expect(generator.calls).toBe(1);
    expect(fallbackGenerator.calls).toBe(1);
    expect(quota.used).toBe(1);
    // Se suman los tokens de ambos intentos.
    if (result.status === 'answered') expect(result.usage.promptTokens).toBe(20);
  });

  it('si ambas fallan el validador, se abstiene', async () => {
    const quota = fakeQuota();
    const fallbackGenerator = fakeGenerator(INVALID);
    const result = await answerQuestion(
      { ...base, generator: fakeGenerator(INVALID), fallbackGenerator, quota },
      ask,
    );
    expect(result).toMatchObject({ status: 'abstained', reason: 'validation_failed' });
    expect(fallbackGenerator.calls).toBe(1);
    expect(quota.used).toBe(1);
  });

  it('un error no pasajero de la rápida pasa a la fuerte', async () => {
    const quota = fakeQuota();
    const fallbackGenerator = fakeGenerator(VALID_ANSWER);
    const result = await answerQuestion(
      {
        ...base,
        generator: { generateJson: () => Promise.reject(new Error('modelo no encontrado')) },
        fallbackGenerator,
        quota,
      },
      ask,
    );
    expect(result.status).toBe('answered');
    expect(quota.used).toBe(1);
  });

  it('un límite de uso (429) no pasa a la fuerte y la pregunta no cuenta', async () => {
    const quota = fakeQuota();
    const fallbackGenerator = fakeGenerator(VALID_ANSWER);
    await expect(
      answerQuestion(
        {
          ...base,
          generator: {
            generateJson: () => Promise.reject(new Error('{"error":{"code":429}}')),
          },
          fallbackGenerator,
          quota,
        },
        ask,
      ),
    ).rejects.toThrow('429');
    expect(fallbackGenerator.calls).toBe(0);
    expect(quota.used).toBe(0);
  });

  it('si la fuerte también falla tras un error, la pregunta no cuenta', async () => {
    const quota = fakeQuota();
    await expect(
      answerQuestion(
        {
          ...base,
          generator: { generateJson: () => Promise.reject(new Error('500')) },
          fallbackGenerator: { generateJson: () => Promise.reject(new Error('500 otra vez')) },
          quota,
        },
        ask,
      ),
    ).rejects.toThrow('otra vez');
    expect(quota.used).toBe(0);
  });

  it('si la fuerte falla tras una respuesta inválida, se abstiene y cuenta', async () => {
    const quota = fakeQuota();
    const result = await answerQuestion(
      {
        ...base,
        generator: fakeGenerator(INVALID),
        fallbackGenerator: { generateJson: () => Promise.reject(new Error('500')) },
        quota,
      },
      ask,
    );
    expect(result).toMatchObject({
      status: 'abstained',
      reason: 'validation_failed',
      detail: 'unknown_fragment',
    });
    expect(quota.used).toBe(1);
  });

  it('detenida durante el segundo intento: corta y no cuenta', async () => {
    const quota = fakeQuota();
    const stop = new AbortController();
    let signalSeen: AbortSignal | undefined;
    await expect(
      answerQuestion(
        {
          ...base,
          generator: fakeGenerator(INVALID),
          fallbackGenerator: {
            generateJson(request: { signal?: AbortSignal }) {
              signalSeen = request.signal;
              stop.abort();
              return Promise.reject(new Error('aborted'));
            },
          },
          quota,
        },
        { ...ask, signal: stop.signal },
      ),
    ).rejects.toThrow('aborted');
    expect(signalSeen).toBe(stop.signal);
    expect(quota.used).toBe(0);
  });
});
