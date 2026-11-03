import type { ServerEnv } from '../../config/env';
import type { EmbeddingProvider } from './embedding-provider';

/**
 * Punto único de construcción del proveedor de embeddings.
 *
 * PENDIENTE: la especificación v2.4 fija gemini-embedding (768 dims) vía
 * Vertex AI, pero región, precios y retención cero aún no están verificados.
 * Hasta implementarlo, el worker falla al arrancar en lugar de producir
 * embeddings falsos.
 */
export function createEmbeddingProvider(_env: ServerEnv): EmbeddingProvider {
  throw new Error(
    'Proveedor de embeddings no implementado: ver src/services/llm/create-embedding-provider.ts',
  );
}
