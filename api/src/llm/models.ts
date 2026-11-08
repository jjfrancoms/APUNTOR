import { GENERATION_MODEL } from './vertex';

/**
 * Dos modelos según la tarea:
 * - **rápido** (`fast`): lo que el estudiante espera en el momento (respuestas del chat).
 * - **fuerte** (`strong`): trabajo que se hace una vez y se guarda (OCR, resúmenes de tema), y
 *   segundo intento del chat cuando la respuesta rápida no pasa el validador de citas.
 * `CHAT_MODEL` y `SUMMARY_MODEL` siguen valiendo como ajustes más específicos.
 */
export interface ModelChoice {
  fast: string;
  strong: string;
  /** Modelo del chat (primer intento). */
  chat: string;
  /** Modelo de los resúmenes de tema. */
  summary: string;
  /** Modelo del OCR en el worker. */
  ocr: string;
}

export interface ModelEnv {
  MODEL_FAST?: string | undefined;
  MODEL_STRONG?: string | undefined;
  GENERATION_MODEL?: string | undefined;
  CHAT_MODEL?: string | undefined;
  SUMMARY_MODEL?: string | undefined;
}

export function resolveModels(env: ModelEnv): ModelChoice {
  const base = env.GENERATION_MODEL ?? GENERATION_MODEL;
  const fast = env.MODEL_FAST ?? env.CHAT_MODEL ?? base;
  const strong = env.MODEL_STRONG ?? base;
  return {
    fast,
    strong,
    chat: env.CHAT_MODEL ?? fast,
    summary: env.SUMMARY_MODEL ?? strong,
    ocr: strong,
  };
}
