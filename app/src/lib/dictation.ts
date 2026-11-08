import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Dictado por voz. En la web usa el reconocimiento de voz del navegador (Chrome, Edge, Safari):
 * el navegador pide permiso para el micrófono la primera vez y no se gasta IA. En el teléfono
 * (Expo Go) el teclado ya trae su propio dictado: la app solo lo indica.
 */

interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0?: { readonly transcript: string };
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

export type DictationSupport = 'web' | 'keyboard' | 'none';
export type DictationError = 'denied' | 'no-speech' | 'failed';

function recognitionCtor(): RecognitionCtor | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export function dictationSupport(): DictationSupport {
  if (Platform.OS !== 'web') return 'keyboard';
  return recognitionCtor() ? 'web' : 'none';
}

/** Une el texto dictado al que ya estaba escrito, con un espacio entre medio. */
export function appendDictated(base: string, dictated: string): string {
  const said = dictated.trim();
  if (said.length === 0) return base;
  const before = base.trimEnd();
  return before.length === 0 ? said : `${before} ${said}`;
}

export function mapRecognitionError(code: string): DictationError {
  if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
    return 'denied';
  }
  return code === 'no-speech' ? 'no-speech' : 'failed';
}

export function useDictation(options: {
  language: 'es' | 'en';
  value: string;
  onChange: (text: string) => void;
}) {
  const { language, value, onChange } = options;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<DictationError | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const base = useRef('');
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => () => recognition.current?.stop(), []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    base.current = value;
    const r = new Ctor();
    r.lang = language === 'es' ? 'es-PE' : 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i]?.[0]?.transcript ?? '';
      }
      change.current(appendDictated(base.current, text));
    };
    r.onerror = (event) => setError(mapRecognitionError(event.error));
    r.onend = () => {
      setListening(false);
      recognition.current = null;
    };
    recognition.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setError('failed');
    }
  }, [language, value]);

  return { support: dictationSupport(), listening, error, start, stop };
}
