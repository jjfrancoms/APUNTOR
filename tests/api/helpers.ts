import { EMBEDDING_DIMENSIONS } from '../../db/schema';
import type { EmbeddingProvider } from '../../api/src/llm/embedding-provider';
import type { JsonGenerator } from '../../api/src/llm/vertex';
import type { RetrievedChunk } from '../../api/src/rag/retriever';
import { normalizeWaitlistEmail, type WaitlistRecord, type WaitlistRepository } from '../../api/src/waitlist';

export const CHUNK: RetrievedChunk = {
  id: '00000000-0000-4000-8000-000000000001',
  documentId: '00000000-0000-4000-8000-0000000000aa',
  pageNumber: 12,
  chunkIndex: 0,
  content: 'La mitocondria produce ATP mediante la respiración celular.',
  sectionTitle: null,
  similarity: 0.9,
};

export const VALID_ANSWER = JSON.stringify({
  answer_found: true,
  claims: [
    {
      text: 'La mitocondria produce ATP.',
      citations: [{ fragment_id: CHUNK.id, quote: 'La mitocondria produce ATP' }],
    },
  ],
});

export const fakeEmbedder: EmbeddingProvider = {
  dimensions: EMBEDDING_DIMENSIONS,
  maxBatchSize: 16,
  embed: (texts) =>
    Promise.resolve(texts.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1))),
};

export function fakeGenerator(text: string): JsonGenerator & { calls: number } {
  const generator = {
    calls: 0,
    generateJson() {
      generator.calls += 1;
      return Promise.resolve({
        text,
        usage: { promptTokens: 10, outputTokens: 5, thoughtsTokens: 2 },
      });
    },
  };
  return generator;
}

/** Lista de espera en memoria con la misma semántica que el repositorio real. */
export function fakeWaitlist(): WaitlistRepository & { entries: WaitlistRecord[] } {
  const entries: WaitlistRecord[] = [];
  return {
    entries,
    join({ email, consent, source }) {
      const normalized = normalizeWaitlistEmail(email);
      if (!entries.some((e) => e.email === normalized)) {
        entries.unshift({
          id: crypto.randomUUID(),
          email: normalized,
          consent,
          source,
          createdAt: new Date(0),
        });
      }
      return Promise.resolve();
    },
    list: ({ limit, offset }) => Promise.resolve(entries.slice(offset, offset + limit)),
    remove(id) {
      const index = entries.findIndex((e) => e.id === id);
      if (index === -1) return Promise.resolve(false);
      entries.splice(index, 1);
      return Promise.resolve(true);
    },
    findByEmail(email) {
      const normalized = normalizeWaitlistEmail(email);
      return Promise.resolve(entries.find((e) => e.email === normalized) ?? null);
    },
    removeByEmail(email) {
      const normalized = normalizeWaitlistEmail(email);
      const index = entries.findIndex((e) => e.email === normalized);
      if (index !== -1) entries.splice(index, 1);
      return Promise.resolve();
    },
  };
}

/** Cuota en memoria con la misma semántica que `consume_quota`. */
export function fakeQuota(limit = 20) {
  let used = 0;
  return {
    get used() {
      return used;
    },
    usage() {
      return Promise.resolve({ questions: used, storage_bytes: 0 });
    },
    consume(_userId: string, _kind: string, amount: number) {
      if (used + amount > limit) return Promise.resolve(false);
      used += amount;
      return Promise.resolve(true);
    },
    release(_userId: string, _kind: string, amount: number) {
      used = Math.max(used - amount, 0);
      return Promise.resolve();
    },
  };
}
