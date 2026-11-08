import { describe, expect, it } from 'vitest';
import type { GenAiModels } from '../../api/src/llm/vertex';
import type { FileStorage } from '../../api/src/storage/file-storage';
import { verifySummaryBlocks } from '../../api/src/summary-grounding';
import {
  createTopicSummarizer,
  summaryKey,
  SummaryLimitError,
  type SummaryBilling,
  type SummaryInput,
} from '../../api/src/topic-summary';

const PAGE_2 =
  'La mitocondria produce energía en forma de ATP dentro de la célula. La fórmula es p → q.';
const PAGES = new Map([[2, PAGE_2]]);

describe('verifySummaryBlocks', () => {
  it('conserva la página de lo que sale de la página citada', () => {
    const block = {
      type: 'paragraph' as const,
      text: 'La mitocondria produce ATP en la célula.',
      pages: [2],
    };
    expect(verifySummaryBlocks([block], PAGES)).toEqual([block]);
  });

  it('marca y deja sin página lo que no está en la página citada', () => {
    expect(
      verifySummaryBlocks(
        [{ type: 'paragraph', text: 'Napoleón conquistó Europa rápidamente.', pages: [2] }],
        PAGES,
      ),
    ).toEqual([
      {
        type: 'paragraph',
        text: 'Napoleón conquistó Europa rápidamente.',
        pages: [],
        unverified: true,
      },
    ]);
  });

  it('un párrafo sin página citada no se puede comprobar', () => {
    const [block] = verifySummaryBlocks(
      [{ type: 'paragraph', text: 'La mitocondria produce ATP.', pages: [] }],
      PAGES,
    );
    expect(block).toMatchObject({ unverified: true });
  });

  it('separa de la lista solo los puntos dudosos, en orden', () => {
    expect(
      verifySummaryBlocks(
        [
          {
            type: 'list',
            items: ['Produce energía', 'Napoleón conquistó Europa', 'Forma ATP'],
            pages: [2],
          },
        ],
        PAGES,
      ),
    ).toEqual([
      { type: 'list', items: ['Produce energía'], pages: [2] },
      { type: 'list', items: ['Napoleón conquistó Europa'], pages: [], unverified: true },
      { type: 'list', items: ['Forma ATP'], pages: [2] },
    ]);
  });

  it('una fórmula debe estar en la página, sin contar espacios', () => {
    const present = { type: 'formula' as const, text: 'p→q', pages: [2] };
    expect(verifySummaryBlocks([present], PAGES)).toEqual([present]);
    expect(verifySummaryBlocks([{ type: 'formula', text: 'q → p', pages: [2] }], PAGES)).toEqual([
      { type: 'formula', text: 'q → p', pages: [], unverified: true },
    ]);
  });

  it('no toca títulos ni tablas', () => {
    const blocks = [
      { type: 'heading' as const, text: 'Otro tema' },
      { type: 'table' as const, header: ['a'], rows: [['b']], pages: [2] },
    ];
    expect(verifySummaryBlocks(blocks, PAGES)).toEqual(blocks);
  });
});

function world(options: { markdown?: string; failUpload?: boolean } = {}) {
  const stored = new Map<string, Uint8Array>();
  const storage: FileStorage = {
    download(key) {
      const value = stored.get(key);
      return value ? Promise.resolve(value) : Promise.reject(new Error('no existe'));
    },
    sizeOf: () => Promise.resolve(null),
    delete: () => Promise.resolve(),
    createUploadUrl: () => Promise.resolve(''),
    upload(key, data) {
      if (options.failUpload === true) return Promise.reject(new Error('R2 caído'));
      stored.set(key, data);
      return Promise.resolve();
    },
    createDownloadUrl: () => Promise.resolve(''),
    deletePrefix: () => Promise.resolve(),
  };
  const state = { modelCalls: 0 };
  const models: GenAiModels = {
    embedContent: () => Promise.resolve({}),
    generateContent() {
      state.modelCalls += 1;
      return Promise.resolve({
        text: options.markdown ?? 'La mitocondria produce ATP. (pág. 2)',
      });
    },
  };
  return {
    state,
    storage,
    stored,
    summarizer: createTopicSummarizer({ models, model: 'm', storage }),
  };
}

const INPUT: SummaryInput = {
  filePath: 'u/doc.pdf',
  topic: { id: 't1', parentId: null, title: 'Célula', sourcePages: [2] },
  path: ['Célula'],
  blocks: [{ pageNumber: 2, sectionPath: ['Célula'], text: PAGE_2, charStart: 0, charEnd: 10 }],
  manifest: null,
};

function billing(allowed = true) {
  const calls: string[] = [];
  const value: SummaryBilling = {
    reserve() {
      calls.push('reserve');
      return Promise.resolve(allowed);
    },
    release() {
      calls.push('release');
      return Promise.resolve();
    },
  };
  return { calls, value };
}

describe('cobro de los resúmenes', () => {
  it('cobra una vez al generar y es gratis abrir uno ya guardado', async () => {
    const { summarizer, state } = world();
    const bill = billing();
    await summarizer.get(INPUT, bill.value);
    await summarizer.get(INPUT, bill.value);
    expect(bill.calls).toEqual(['reserve']);
    expect(state.modelCalls).toBe(1);
  });

  it('dos peticiones a la vez del mismo resumen cobran y generan una sola vez', async () => {
    const { summarizer, state } = world();
    const bill = billing();
    const [a, b] = await Promise.all([
      summarizer.get(INPUT, bill.value),
      summarizer.get(INPUT, bill.value),
    ]);
    expect(a).toEqual(b);
    expect(bill.calls).toEqual(['reserve']);
    expect(state.modelCalls).toBe(1);
  });

  it('sin cuota no llama a la IA', async () => {
    const { summarizer, state } = world();
    const bill = billing(false);
    await expect(summarizer.get(INPUT, bill.value)).rejects.toBeInstanceOf(SummaryLimitError);
    expect(state.modelCalls).toBe(0);
    expect(bill.calls).toEqual(['reserve']);
  });

  it('devuelve lo cobrado si la generación queda vacía o no se puede guardar', async () => {
    for (const options of [{ markdown: '' }, { failUpload: true }]) {
      const { summarizer } = world(options);
      const bill = billing();
      await expect(summarizer.get(INPUT, bill.value)).rejects.toThrow();
      expect(bill.calls).toEqual(['reserve', 'release']);
    }
  });

  it('sin cobro (el worker) genera igual y guarda lo no verificado', async () => {
    const { summarizer, stored } = world({ markdown: 'Napoleón conquistó Europa. (pág. 2)' });
    const summary = await summarizer.get(INPUT);
    expect(summary.blocks).toEqual([
      { type: 'paragraph', text: 'Napoleón conquistó Europa.', pages: [], unverified: true },
    ]);
    expect(stored.has(summaryKey(INPUT.filePath, 't1'))).toBe(true);
  });
});
