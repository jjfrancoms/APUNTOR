import { describe, expect, it } from 'vitest';
import { sameTitle, splitDefinition, tidyText, titleKey } from '@/lib/summary-text';

describe('tidyText', () => {
  it('quita espacios antes de la puntuación', () => {
    expect(tidyText('discurso . independiente , claro ; sí : no ) ¿ro ?')).toBe(
      'discurso. independiente, claro; sí: no) ¿ro?',
    );
  });
  it('quita espacios después de ( ¿ ¡', () => {
    expect(tidyText('( a ) ¿ qué ? ¡ hola !')).toBe('(a) ¿qué? ¡hola!');
  });
  it('no toca el texto ya limpio', () => {
    expect(tidyText('Una frase. Otra frase, bien.')).toBe('Una frase. Otra frase, bien.');
  });
});

describe('splitDefinition', () => {
  it('separa un término corto', () => {
    expect(splitDefinition('Proposición: enunciado que es verdadero o falso')).toEqual({
      term: 'Proposición',
      rest: 'enunciado que es verdadero o falso',
    });
  });
  it('no separa si el inicio es largo o es una oración', () => {
    expect(splitDefinition('uno dos tres cuatro cinco seis siete: algo')).toBeNull();
    expect(splitDefinition('Eso es todo. Y además: algo')).toBeNull();
  });
  it('no separa sin dos puntos o sin resto', () => {
    expect(splitDefinition('Sin dos puntos')).toBeNull();
    expect(splitDefinition('Término:')).toBeNull();
    expect(splitDefinition(': resto')).toBeNull();
  });
});

describe('sameTitle', () => {
  it('ignora numeración, mayúsculas y tildes', () => {
    expect(titleKey('Tema 1. Proposiciones y Operadores Lógicos')).toBe(
      'proposiciones y operadores logicos',
    );
    expect(
      sameTitle(
        'Tema 1. Proposiciones y operadores Lógicos',
        '1. proposiciones y operadores lógicos',
      ),
    ).toBe(true);
  });
  it('distingue títulos distintos', () => {
    expect(sameTitle('Valores de verdad', 'Tablas de verdad')).toBe(false);
    expect(sameTitle('', '')).toBe(false);
  });
});
