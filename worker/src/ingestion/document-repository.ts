import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import {
  documentChunks,
  documents,
  topics,
  type ChunkSectionMetadata,
  type DocumentStatus,
} from '../../../db/schema';
import type { FlatTopic } from '../topics/topic-tree';

export interface IngestionDocument {
  id: string;
  filePath: string;
  status: DocumentStatus;
}

export interface EmbeddedChunk {
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sectionTitle: string | null;
  metadata: ChunkSectionMetadata;
  embedding: number[];
}

/** Puerto de persistencia que usa el pipeline de ingestión. */
export interface IngestionRepository {
  getDocument(documentId: string): Promise<IngestionDocument | null>;
  markProcessing(documentId: string): Promise<void>;
  deleteChunks(documentId: string): Promise<void>;
  insertChunks(chunks: readonly EmbeddedChunk[]): Promise<void>;
  /** Reemplaza el árbol de temas del documento (padres antes que hijos). */
  replaceTopics(documentId: string, topics: readonly FlatTopic[]): Promise<void>;
  markCompleted(documentId: string, totalPages: number): Promise<void>;
  markFailed(documentId: string, errorMessage: string): Promise<void>;
}

export class DrizzleIngestionRepository implements IngestionRepository {
  constructor(private readonly db: Database) {}

  async getDocument(documentId: string): Promise<IngestionDocument | null> {
    const rows = await this.db
      .select({ id: documents.id, filePath: documents.filePath, status: documents.status })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    return rows[0] ?? null;
  }

  async markProcessing(documentId: string): Promise<void> {
    await this.db
      .update(documents)
      .set({ status: 'processing', errorMessage: null, updatedAt: sql`now()` })
      .where(eq(documents.id, documentId));
  }

  async deleteChunks(documentId: string): Promise<void> {
    await this.db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  }

  async insertChunks(chunks: readonly EmbeddedChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    await this.db.insert(documentChunks).values([...chunks]);
  }

  async replaceTopics(documentId: string, flat: readonly FlatTopic[]): Promise<void> {
    // UUIDs generados aquí para enlazar padre-hijo en un único INSERT: las FK no
    // diferidas se verifican al final de la sentencia, así que el orden basta.
    const ids = flat.map(() => randomUUID());
    const rows = flat.map((topic, i) => {
      const parentId = topic.parentIndex === null ? null : ids[topic.parentIndex];
      if (parentId === undefined) throw new Error(`parentIndex inválido en el tema ${i}`);
      return {
        id: ids[i] ?? randomUUID(),
        documentId,
        parentTopicId: parentId,
        title: topic.title,
        sourcePages: topic.sourcePages,
      };
    });
    await this.db.transaction(async (tx) => {
      await tx.delete(topics).where(eq(topics.documentId, documentId));
      if (rows.length > 0) await tx.insert(topics).values(rows);
    });
  }

  async markCompleted(documentId: string, totalPages: number): Promise<void> {
    await this.db
      .update(documents)
      .set({ status: 'completed', totalPages, errorMessage: null, updatedAt: sql`now()` })
      .where(eq(documents.id, documentId));
  }

  async markFailed(documentId: string, errorMessage: string): Promise<void> {
    await this.db
      .update(documents)
      .set({ status: 'failed', errorMessage, updatedAt: sql`now()` })
      .where(eq(documents.id, documentId));
  }
}
