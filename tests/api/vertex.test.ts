import { describe, expect, it } from 'vitest';
import {
  chooseGenAiBackend,
  formatEmbeddingInput,
  VertexEmbeddingProvider,
  VertexGenerator,
  type GenAiModels,
} from '../../api/src/llm/vertex';

type EmbedParams = Parameters<GenAiModels['embedContent']>[0];
type GenerateParams = Parameters<GenAiModels['generateContent']>[0];

function fakeModels(overrides: Partial<GenAiModels> = {}): GenAiModels {
  return {
    embedContent: (params) =>
      Promise.resolve({ embeddings: params.contents.map(() => ({ values: [0.1, 0.2] })) }),
    generateContent: () => Promise.resolve({ text: '{}' }),
    ...overrides,
  };
}

describe('VertexEmbeddingProvider', () => {
  it('usa prefijos en el texto, un Content por texto y la dimensión pedida', async () => {
    let seen: EmbedParams | undefined;
    const provider = new VertexEmbeddingProvider(
      fakeModels({
        embedContent: (params) => {
          seen = params;
          return Promise.resolve({ embeddings: params.contents.map(() => ({ values: [1] })) });
        },
      }),
      768,
    );
    await provider.embed(['a', 'b'], 'document');
    expect(seen?.model).toBe('gemini-embedding-2');
    expect(seen?.config.outputDimensionality).toBe(768);
    expect(seen?.contents).toEqual([
      { parts: [{ text: 'title: none | text: a' }] },
      { parts: [{ text: 'title: none | text: b' }] },
    ]);
    expect(formatEmbeddingInput('x', 'query')).toBe('task: question answering | query: x');
  });

  it('falla si el modelo devuelve menos vectores que textos', async () => {
    const provider = new VertexEmbeddingProvider(
      fakeModels({ embedContent: () => Promise.resolve({ embeddings: [] }) }),
      768,
    );
    await expect(provider.embed(['a'], 'query')).rejects.toThrow('0 embeddings');
  });
});

describe('VertexGenerator', () => {
  it('pide JSON a gemini-2.5-flash y separa los tokens de razonamiento', async () => {
    let seen: GenerateParams | undefined;
    const generator = new VertexGenerator(
      fakeModels({
        generateContent: (params) => {
          seen = params;
          return Promise.resolve({
            text: '{"ok":true}',
            usageMetadata: {
              promptTokenCount: 11,
              candidatesTokenCount: 7,
              thoughtsTokenCount: 3,
            },
          });
        },
      }),
    );
    const result = await generator.generateJson({ system: 's', user: 'u', schema: {} });
    expect(seen?.model).toBe('gemini-2.5-flash');
    expect(seen?.config.responseMimeType).toBe('application/json');
    expect(seen?.config.temperature).toBe(0);
    expect(result.usage).toEqual({ promptTokens: 11, outputTokens: 7, thoughtsTokens: 3 });
  });
});

describe('chooseGenAiBackend', () => {
  it('usa la API de Gemini si hay clave, aunque también haya proyecto de Vertex', () => {
    expect(
      chooseGenAiBackend({
        GEMINI_API_KEY: 'k',
        GOOGLE_CLOUD_PROJECT: 'apuntor',
        GOOGLE_CLOUD_LOCATION: 'us-central1',
      }),
    ).toEqual({ kind: 'gemini-api', apiKey: 'k' });
  });

  it('sin clave usa Vertex AI', () => {
    expect(
      chooseGenAiBackend({ GOOGLE_CLOUD_PROJECT: 'apuntor', GOOGLE_CLOUD_LOCATION: 'us-central1' }),
    ).toEqual({ kind: 'vertex', project: 'apuntor', location: 'us-central1' });
  });

  it('sin ninguno de los dos, falla con un mensaje claro', () => {
    expect(() => chooseGenAiBackend({})).toThrow('GEMINI_API_KEY');
  });
});

describe('modelo configurable', () => {
  it('usa el modelo indicado en lugar del de la especificación', async () => {
    let seen = '';
    const generator = new VertexGenerator(
      fakeModels({
        generateContent: (params) => {
          seen = params.model;
          return Promise.resolve({ text: '{}' });
        },
      }),
      'gemini-3.8-flash',
    );
    await generator.generateJson({ system: 's', user: 'u', schema: {} });
    expect(seen).toBe('gemini-3.8-flash');
  });
});
