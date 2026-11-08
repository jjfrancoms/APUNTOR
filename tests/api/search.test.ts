import { describe, expect, it } from 'vitest';
import { buildSnippet, FOLD_FROM, FOLD_TO, foldText, searchTokens } from '../../api/src/search';

function highlighted(result: ReturnType<typeof buildSnippet>): string[] {
  return result.highlights.map((h) => result.snippet.slice(h.start, h.start + h.length));
}

describe('plegado de texto', () => {
  it('cada letra acentuada tiene su pareja y las marcas combinantes sobran', () => {
    expect(FOLD_FROM.length - FOLD_TO.length).toBe(5);
  });

  it('quita acentos y mayúsculas, también con letras descompuestas', () => {
    expect(foldText('LÓGICA Ñandú')).toBe('logica nandu');
    expect(foldText('lógica')).toBe('logica');
  });

  it('separa palabras y conserva los números de sección', () => {
    expect(searchTokens('  ¿Qué es, el teorema 2.1?')).toEqual([
      'que',
      'es',
      'el',
      'teorema',
      '2.1',
    ]);
    expect(searchTokens('?!')).toEqual([]);
  });
});

describe('buildSnippet', () => {
  it('resalta la palabra original completa, aunque tenga acentos', () => {
    const result = buildSnippet('Los límites laterales.', ['limit']);
    expect(result.snippet).toBe('Los límites laterales.');
    expect(highlighted(result)).toEqual(['límites']);
  });

  it('mantiene las posiciones con letras descompuestas', () => {
    expect(highlighted(buildSnippet('Lógica formal', ['logica']))).toEqual(['Lógica']);
  });

  it('solo coincide al principio de una palabra', () => {
    expect(buildSnippet('Ilimitado y nada más', ['limit']).highlights).toEqual([]);
  });

  it('recorta alrededor de la coincidencia con puntos suspensivos y sin cortar palabras', () => {
    const before = 'palabra '.repeat(40);
    const after = ' otra'.repeat(60);
    const result = buildSnippet(`${before}mitocondria${after}`, ['mitocondria']);
    expect(result.snippet.startsWith('…palabra')).toBe(true);
    expect(result.snippet.endsWith('otra…')).toBe(true);
    expect(result.snippet.length).toBeLessThanOrEqual(172);
    expect(highlighted(result)).toEqual(['mitocondria']);
  });

  it('prefiere la zona con más palabras distintas de la búsqueda', () => {
    const relleno = 'x '.repeat(200);
    const result = buildSnippet(`alfa ${relleno} alfa beta final`, ['alfa', 'beta']);
    expect(highlighted(result)).toEqual(['alfa', 'beta']);
  });

  it('sin coincidencias devuelve el principio, y compacta los espacios', () => {
    const result = buildSnippet('Texto\n\n  con   saltos', ['nada']);
    expect(result).toEqual({ snippet: 'Texto con saltos', highlights: [] });
  });
});
