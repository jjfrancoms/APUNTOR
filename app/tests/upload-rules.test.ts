import { describe, expect, it } from 'vitest';
import { extLabel, validateUpload } from '../src/lib/upload-rules';
import { overlapScore, tokenize } from '../src/lib/text-search';

describe('upload-rules', () => {
  it('etiqueta formatos', () => {
    expect(['a.pdf', 'b.pptx', 'c.docx', 'd.jpg'].map(extLabel)).toEqual([
      'PDF',
      'PPT',
      'DOC',
      'IMG',
    ]);
  });
  it('valida en orden: tamaño, formato, espacio', () => {
    expect(validateUpload({ name: 'clase.mp4', sizeMb: 212 }, 0, 500)).toBe('UP_SIZE');
    expect(validateUpload({ name: 'x.zip', sizeMb: 1 }, 0, 500)).toBe('UP_FORMAT');
    expect(validateUpload({ name: 'x.pdf', sizeMb: 51 }, 0, 500)).toBe('UP_SIZE');
    expect(validateUpload({ name: 'x.pdf', sizeMb: 30 }, 480, 500)).toBe('UP_QUOTA');
    expect(validateUpload({ name: 'x.pdf', sizeMb: 30 }, 0, 500)).toBeNull();
  });
  it('acepta solo los formatos que lee el servidor', () => {
    for (const name of ['a.txt', 'b.md', 'c.docx', 'd.pptx', 'e.HEIC', 'f.jpeg']) {
      expect(validateUpload({ name, sizeMb: 1 }, 0, 500)).toBeNull();
    }
    // Los formatos antiguos de Office no se leen: se piden como .docx/.pptx.
    expect(validateUpload({ name: 'viejo.doc', sizeMb: 1 }, 0, 500)).toBe('UP_FORMAT');
    expect(validateUpload({ name: 'viejo.ppt', sizeMb: 1 }, 0, 500)).toBe('UP_FORMAT');
  });
  it('no inventa el idioma por el nombre del archivo', () => {
    expect(validateUpload({ name: 'Resumen_chino.pdf', sizeMb: 1 }, 0, 500)).toBeNull();
  });
});

describe('text-search', () => {
  it('normaliza y descarta palabras vacías', () => {
    expect(tokenize('¿Qué es el Límite lateral?')).toEqual(['limite', 'lateral']);
  });
  it('mide la superposición', () => {
    expect(overlapScore('límite lateral', 'El límite lateral por la derecha')).toBe(1);
    expect(overlapScore('penicilina', 'El límite lateral')).toBe(0);
  });
});

describe('buildQuiz', async () => {
  const { buildQuiz } = await import('../src/lib/quiz');
  const { contentItems } = await import('../src/store/content');
  it('arma una pregunta por definición/concepto con la respuesta correcta entre las opciones', () => {
    for (const classId of ['c1', 'c4', 'f1', 'h2']) {
      const qs = buildQuiz(contentItems, classId);
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(q.page).toBeGreaterThan(0);
        // Nada se recorta: ni las opciones ni la descripción.
        for (const o of q.options) expect(o.endsWith('…')).toBe(false);
        expect(q.quote && contentItems.some((i) => i.text === q.quote)).toBe(true);
        expect(q.options[q.answer]).toBe(contentItems.find((i) => i.text === q.quote)?.title);
      }
    }
  });
});
