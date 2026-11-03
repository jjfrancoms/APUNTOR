import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  documentChunks,
  documents,
  type ChunkSectionMetadata,
  type DocumentStatus,
} from '../../db/schema';

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
