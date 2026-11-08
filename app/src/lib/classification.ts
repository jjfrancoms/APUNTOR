/** Confianza de la IA al sugerir un curso, en palabras (la pantalla 16 nunca muestra el número). */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export const HIGH_CONFIDENCE = 0.75;
export const MEDIUM_CONFIDENCE = 0.45;

export function confidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null) return 'low';
  if (confidence >= HIGH_CONFIDENCE) return 'high';
  if (confidence >= MEDIUM_CONFIDENCE) return 'medium';
  return 'low';
}
