import { GENERATION_MODEL } from './vertex';

/**
 * Tres niveles de modelo Gemini según la tarea:
 * - **bajo** (`low`): tareas pequeñas (p. ej. clasificar un documento en un curso).
 * - **medio** (`medium`): lo que el estudiante espera en el momento (primer intento del chat).
 * - **alto** (`high`): trabajo que se hace una vez y se guarda (OCR, resúmenes de tema), segundo
 *   intento del chat cuando la respuesta no pasa el validador de citas.
 * `CHAT_MODEL` y `SUMMARY_MODEL` siguen valiendo como ajustes más específicos. `MODEL_FAST` y
 * `MODEL_STRONG` se aceptan como nombres antiguos de medio y alto.
 */
export interface ModelChoice {
  low: string;
  medium: string;
  high: string;
  /** Modelo del chat (primer intento). */
  chat: string;
  /** Modelo de los resúmenes de tema. */
  summary: string;
  /** Modelo del OCR en el worker. */
  ocr: string;
}

/**
 * Razonamiento previo por nivel. Nunca 0: el modelo lite lo rechaza con HTTP 400 (medido).
 * El alto no lleva tope: lo decide el modelo.
 */
export const LOW_THINKING_BUDGET = 512;
export const MEDIUM_THINKING_BUDGET = 1024;
export const HIGH_THINKING_BUDGET: number | undefined = undefined;

export interface ModelEnv {
  MODEL_LOW?: string | undefined;
  MODEL_MEDIUM?: string | undefined;
  MODEL_HIGH?: string | undefined;
  /** Nombre antiguo del nivel medio. */
  MODEL_FAST?: string | undefined;
  /** Nombre antiguo del nivel alto. */
  MODEL_STRONG?: string | undefined;
  GENERATION_MODEL?: string | undefined;
  CHAT_MODEL?: string | undefined;
  SUMMARY_MODEL?: string | undefined;
}

export function resolveModels(env: ModelEnv): ModelChoice {
  const base = env.GENERATION_MODEL ?? GENERATION_MODEL;
  const medium = env.MODEL_MEDIUM ?? env.MODEL_FAST ?? env.CHAT_MODEL ?? base;
  const high = env.MODEL_HIGH ?? env.MODEL_STRONG ?? base;
  const low = env.MODEL_LOW ?? medium;
  return {
    low,
    medium,
    high,
    chat: env.CHAT_MODEL ?? medium,
    summary: env.SUMMARY_MODEL ?? high,
    ocr: high,
  };
}
