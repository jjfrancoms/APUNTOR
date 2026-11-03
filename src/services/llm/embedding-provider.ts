/**
 * Contrato del proveedor de embeddings. La implementación concreta (Gemini vía
 * Vertex AI según la especificación v2.4) se inyecta en el worker; los servicios
 * de ingestión y RAG dependen solo de esta interfaz.
 */
export interface EmbeddingProvider {
  /** Dimensión del vector devuelto; debe coincidir con `EMBEDDING_DIMENSIONS`. */
  readonly dimensions: number;
  /** Máximo de textos por llamada que admite el proveedor. */
  readonly maxBatchSize: number;
  embed(texts: readonly string[], kind: 'document' | 'query'): Promise<number[][]>;
}

export class EmbeddingDimensionError extends Error {
  constructor(expected: number, received: number) {
    super(`Embedding con dimensión ${received}; se esperaba ${expected}`);
    this.name = 'EmbeddingDimensionError';
  }
}

export function assertEmbeddingDimensions(vectors: readonly number[][], expected: number): void {
  for (const vector of vectors) {
    if (vector.length !== expected) throw new EmbeddingDimensionError(expected, vector.length);
    if (!vector.every((v) => Number.isFinite(v))) {
      throw new Error('Embedding con valores no finitos');
    }
  }
}
