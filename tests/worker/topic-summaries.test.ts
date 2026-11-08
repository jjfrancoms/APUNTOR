import { describe, expect, it, vi } from 'vitest';
import { manifestKey, type PageManifest } from '../../api/src/page-manifest';
import type { FileStorage } from '../../api/src/storage/file-storage';
import type { ChunkRow, TopicRow } from '../../api/src/topic-content';
import type { SummaryInput, TopicSummarizer } from '../../api/src/topic-summary';
import {
  createSummaryPregenerator,
  selectSummaryTopics,
} from '../../worker/src/ingestion/topic-summaries';

const TOPICS: TopicRow[] = [
  { id: 'a', parentId: null, title: '1. Lógica', sourcePages: [1, 2] },
  { id: 'a1', parentId: 'a', title: '1.1 Tablas', sourcePages: [1] },
  { id: 'a2', parentId: 'a', title: '1.2 Reglas', sourcePages: [2] },
  { id: 'a2x', parentId: 'a2', title: 'Modus ponens', sourcePages: [2] },
  { id: 'b', parentId: null, title: '2. Conjuntos', sourcePages: [3] },
];

const CHUNKS: ChunkRow[] = [
  {
    pageNumber: 1,
    chunkIndex: 0,
    content: 'Tablas de verdad.',
    sectionPath: ['1. Lógica', '1.1 Tablas'],
    charStart: 0,
    charEnd: 17,
  },
  {
    pageNumber: 2,
    chunkIndex: 1,
    content: 'Regla.',
    sectionPath: ['1. Lógica', '1.2 Reglas', 'Modus ponens'],
    charStart: 0,
    charEnd: 6,
  },
  {
    pageNumber: 3,
    chunkIndex: 2,
    content: 'Un conjunto.',
    sectionPath: ['2. Conjuntos'],
    charStart: 0,
    charEnd: 12,
  },
];

const MANIFEST: PageManifest = {
  version: 1,
  pages: [
    { pageNumber: 1, text: 'Tablas de\nverdad.' },
    { pageNumber: 2, text: 'Regla.' },
    { pageNumber: 3, text: 'Un conjunto.' },
  ],
};

function storageWith(manifest: PageManifest | null): FileStorage {
  return {
    download: (key) =>
      key === manifestKey('u/doc.pdf') && manifest
        ? Promise.resolve(new TextEncoder().encode(JSON.stringify(manifest)))
        : Promise.reject(new Error('no existe')),
    sizeOf: () => Promise.resolve(1),
    delete: () => Promise.resolve(),
    createUploadUrl: () => Promise.resolve(''),
    upload: () => Promise.resolve(),
    createDownloadUrl: () => Promise.resolve(''),
    deletePrefix: () => Promise.resolve(),
  };
}

function fakeSummarizer(fail: (input: SummaryInput) => Error | null = () => null) {
  const inputs: SummaryInput[] = [];
  const summarizer: Pick<TopicSummarizer, 'get'> = {
    get(input) {
      inputs.push(input);
      const error = fail(input);
      if (error) return Promise.reject(error);
      return Promise.resolve({ version: 1, topicId: input.topic.id, model: 'm', blocks: [] });
    },
  };
  return { summarizer, inputs };
}

const input = { documentId: 'd1', filePath: 'u/doc.pdf', topics: TOPICS, chunks: CHUNKS };

describe('selectSummaryTopics', () => {
  it('elige temas raíz y hojas, en orden del documento y con tope', () => {
    expect(selectSummaryTopics(TOPICS).map((t) => t.id)).toEqual(['a', 'a1', 'a2x', 'b']);
    expect(selectSummaryTopics(TOPICS, 2).map((t) => t.id)).toEqual(['a', 'a1']);
  });
});

describe('createSummaryPregenerator', () => {
  it('resume uno por uno con el texto estructurado de la página y el manifiesto', async () => {
    const { summarizer, inputs } = fakeSummarizer();
    const result = await createSummaryPregenerator({
      summarizer,
      storage: storageWith(MANIFEST),
    }).generate(input);
    expect(result).toEqual({ generated: 4, failed: 0, skipped: 0 });
    expect(inputs.map((i) => i.topic.id)).toEqual(['a', 'a1', 'a2x', 'b']);
    expect(inputs[1]?.path).toEqual(['1. Lógica', '1.1 Tablas']);
    expect(inputs[1]?.blocks[0]?.text).toBe('Tablas de\nverdad.');
    expect(inputs[1]?.manifest).toEqual(MANIFEST);
  });

  it('sin manifiesto usa el texto de los fragmentos', async () => {
    const { summarizer, inputs } = fakeSummarizer();
    await createSummaryPregenerator({ summarizer, storage: storageWith(null) }).generate(input);
    expect(inputs[1]?.blocks[0]?.text).toBe('Tablas de verdad.');
    expect(inputs[1]?.manifest).toBeNull();
  });

  it('un tema que falla no detiene los demás ni registra contenido', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { summarizer, inputs } = fakeSummarizer((i) =>
      i.topic.id === 'a1' ? new Error('Tablas de verdad: respuesta rota') : null,
    );
    const result = await createSummaryPregenerator({
      summarizer,
      storage: storageWith(MANIFEST),
    }).generate(input);
    expect(result).toEqual({ generated: 3, failed: 1, skipped: 0 });
    expect(inputs).toHaveLength(4);
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Tablas|Lógica/u);
    warn.mockRestore();
  });

  it('ante un límite de la IA deja el resto para cuando se pidan', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { summarizer, inputs } = fakeSummarizer((i) =>
      i.topic.id === 'a1' ? new Error('RESOURCE_EXHAUSTED') : null,
    );
    const result = await createSummaryPregenerator({
      summarizer,
      storage: storageWith(MANIFEST),
    }).generate(input);
    expect(result).toEqual({ generated: 1, failed: 1, skipped: 2 });
    expect(inputs).toHaveLength(2);
    warn.mockRestore();
  });

  it('respeta el tiempo máximo dentro del trabajo de la cola', async () => {
    let clock = 0;
    const { summarizer, inputs } = fakeSummarizer(() => {
      clock += 1_000;
      return null;
    });
    const result = await createSummaryPregenerator({
      summarizer,
      storage: storageWith(MANIFEST),
      timeBudgetMs: 1_500,
      now: () => clock,
    }).generate(input);
    expect(result).toEqual({ generated: 2, failed: 0, skipped: 2 });
    expect(inputs).toHaveLength(2);
  });
});
