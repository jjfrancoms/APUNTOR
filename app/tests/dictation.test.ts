import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));

const { appendDictated, dictationSupport, mapRecognitionError } =
  await import('../src/lib/dictation');

describe('dictado por voz', () => {
  it('une lo dictado a lo ya escrito', () => {
    expect(appendDictated('', '  qué es una tautología ')).toBe('qué es una tautología');
    expect(appendDictated('Explícame', 'la negación')).toBe('Explícame la negación');
    expect(appendDictated('Hola ', '')).toBe('Hola ');
  });

  it('distingue el permiso negado de otros fallos', () => {
    expect(mapRecognitionError('not-allowed')).toBe('denied');
    expect(mapRecognitionError('audio-capture')).toBe('denied');
    expect(mapRecognitionError('no-speech')).toBe('no-speech');
    expect(mapRecognitionError('network')).toBe('failed');
  });

  it('en un navegador sin reconocimiento de voz no ofrece dictado', () => {
    expect(dictationSupport()).toBe('none');
    (globalThis as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = class {};
    expect(dictationSupport()).toBe('web');
    delete (globalThis as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  });
});
