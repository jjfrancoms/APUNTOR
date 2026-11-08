import { describe, expect, it } from 'vitest';
import type { GenAiModels } from '../../api/src/llm/vertex';
import type { FileStorage } from '../../api/src/storage/file-storage';
import { parsePageList, parseSummaryMarkdown } from '../../api/src/summary-markdown';
import {
  createTopicSummarizer,
  SUMMARY_MAX_OUTPUT_TOKENS,
  summaryKey,
  toPixelBox,
  type ImageCropper,
} from '../../api/src/topic-summary';

const MARKDOWN = [
  '## Tablas de verdad',
  'Una tabla de **verdad** muestra todos los casos. (pág. 2)',
  '',
  '- Con n variables hay 2ⁿ filas',
  '- Cada fila es un caso (págs. 2, 3)',
  '',
  '| p | q | p ∧ q |',
  '|-|-|-|',
  '| 1 | 1 | 1 |',
  '| 1 | 0 |',
  '(pág. 3)',
  '',
  '>> ((p → q) ∧ p) → q (pág. 3)',
  '![Árbol semántico](figura:3:100,200,400,800) (pág. 3)',
].join('\n');

describe('Markdown del resumen', () => {
  it('lo convierte en bloques con estructura y páginas', () => {
    expect(parseSummaryMarkdown(MARKDOWN)).toEqual([
      { type: 'heading', text: 'Tablas de verdad' },
      { type: 'paragraph', text: 'Una tabla de verdad muestra todos los casos.', pages: [2] },
      {
        type: 'list',
        items: ['Con n variables hay 2ⁿ filas', 'Cada fila es un caso'],
        pages: [2, 3],
      },
      {
        type: 'table',
        header: ['p', 'q', 'p ∧ q'],
        rows: [
          ['1', '1', '1'],
          ['1', '0', ''],
        ],
        pages: [3],
      },
      { type: 'formula', text: '((p → q) ∧ p) → q', pages: [3] },
      { type: 'figure', page: 3, box: [100, 200, 400, 800], caption: 'Árbol semántico' },
    ]);
  });

  it('lee listas de páginas con rangos', () => {
    expect(parsePageList('2, 4–6')).toEqual([2, 4, 5, 6]);
    expect(parsePageList('x, 0')).toEqual([]);
  });
});

describe('caja de figura', () => {
  const page = { width: 1000, height: 1400 };
  it('pasa de 0–1000 a píxeles con margen', () => {
    expect(toPixelBox([100, 200, 400, 800], page)).toEqual({
      x: 185,
      y: 119,
      width: 630,
      height: 462,
    });
  });
  it('descarta cajas inválidas, diminutas o de más de media página', () => {
    expect(toPixelBox([400, 200, 100, 800], page)).toBeNull();
    expect(toPixelBox([100, 100, 105, 105], page)).toBeNull();
    expect(toPixelBox([0, 0, 1000, 1000], page)).toBeNull();
  });
});

function memoryStorage() {
  const files = new Map<string, Uint8Array>();
  const storage: FileStorage = {
    download(key) {
      const f = files.get(key);
      return f ? Promise.resolve(f) : Promise.reject(new Error('NoSuchKey'));
    },
    sizeOf: () => Promise.resolve(null),
    delete(key) {
      files.delete(key);
      return Promise.resolve();
    },
    createUploadUrl: () => Promise.resolve(''),
    upload(key, data) {
      files.set(key, data);
      return Promise.resolve();
    },
    createDownloadUrl: (key) => Promise.resolve(key),
    deletePrefix: () => Promise.resolve(),
  };
  return { files, storage };
}

describe('resumen de un tema', () => {
  const input = () => {
    return {
      filePath: 'u1/doc.pdf',
      topic: { id: 't1', parentId: null, title: '1.2 Tablas', sourcePages: [2, 3] },
      path: ['Capítulo I', '1.2 Tablas'],
      blocks: [
        { pageNumber: 2, sectionPath: ['1.2 Tablas'], text: 'Texto 2', charStart: 0, charEnd: 7 },
        { pageNumber: 3, sectionPath: ['1.2 Tablas'], text: 'Texto 3', charStart: 0, charEnd: 7 },
      ],
      manifest: {
        version: 1 as const,
        pages: [
          { pageNumber: 2, text: 'Texto 2' },
          {
            pageNumber: 3,
            text: 'Texto 3',
            image: { key: 'u1/doc/page-3.png', width: 1000, height: 1400 },
          },
        ],
      },
    };
  };

  it('pide Markdown con tope de salida, recorta figuras y descarta páginas que no vio', async () => {
    const { files, storage } = memoryStorage();
    files.set('u1/doc/page-3.png', new Uint8Array([9]));
    const calls: Parameters<GenAiModels['generateContent']>[0][] = [];
    const models = {
      embedContent: () => Promise.resolve({}),
      generateContent: (params: Parameters<GenAiModels['generateContent']>[0]) => {
        calls.push(params);
        return Promise.resolve({
          text: `${MARKDOWN}\nInventado (pág. 9)\n![Otra](figura:9:100,100,300,300)`,
        });
      },
    } as GenAiModels;
    const crops: unknown[] = [];
    const crop: ImageCropper = (_png, box) => {
      crops.push(box);
      return Promise.resolve({ png: new Uint8Array([1]), width: box.width, height: box.height });
    };
    const summarizer = createTopicSummarizer({ models, model: 'lite', storage, crop });
    const summary = await summarizer.get(input());

    expect(calls[0]?.config.maxOutputTokens).toBe(SUMMARY_MAX_OUTPUT_TOKENS);
    // Ve la imagen de la página 3 (la 2 no tiene).
    expect(calls[0]?.contents[0]?.parts.filter((p) => 'inlineData' in p)).toHaveLength(1);
    expect(crops).toHaveLength(1);
    const figure = summary.blocks.find((b) => b.type === 'figure');
    expect(figure).toMatchObject({ page: 3, key: 'u1/doc/summaries/t1-fig-0.png' });
    const invented = summary.blocks.find((b) => b.type === 'paragraph' && b.text === 'Inventado');
    expect(invented).toMatchObject({ pages: [] });
    expect(files.has(summaryKey('u1/doc.pdf', 't1'))).toBe(true);

    // La segunda vez sale de lo guardado: no vuelve a llamar a la IA.
    await summarizer.get(input());
    expect(calls).toHaveLength(1);
  });

  it('un resumen vacío es un error', async () => {
    const { storage } = memoryStorage();
    const models = {
      embedContent: () => Promise.resolve({}),
      generateContent: () => Promise.resolve({ text: '' }),
    } as GenAiModels;
    await expect(
      createTopicSummarizer({ models, model: 'lite', storage }).get(input()),
    ).rejects.toThrow('vacío');
  });
});
