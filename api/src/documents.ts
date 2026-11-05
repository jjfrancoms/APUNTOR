import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { documents, type DocumentStatus } from '../../db/schema';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Formatos del README: PDF, PPTX, DOCX y fotos. */
export const UPLOAD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

export function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index === -1 ? '' : fileName.slice(index + 1).toLowerCase();
}

export interface DocumentRecord {
  id: string;
  title: string;
  filePath: string;
  sizeBytes: number;
  status: DocumentStatus;
  totalPages: number | null;
  createdAt: Date;
}

export interface DocumentsRepository {
  create(input: {
    id: string;
    userId: string;
    title: string;
    filePath: string;
    sizeBytes: number;
  }): Promise<void>;
  get(userId: string, documentId: string): Promise<DocumentRecord | null>;
  list(userId: string): Promise<DocumentRecord[]>;
  delete(userId: string, documentId: string): Promise<void>;
  markFailed(documentId: string, message: string): Promise<void>;
}

const columns = {
  id: documents.id,
  title: documents.title,
  filePath: documents.filePath,
  sizeBytes: documents.sizeBytes,
  status: documents.status,
  totalPages: documents.totalPages,
  createdAt: documents.createdAt,
};

/** Toda consulta filtra por usuario, además de RLS. */
export function createDocumentsRepository(db: Database): DocumentsRepository {
  return {
    async create(input) {
      await db.insert(documents).values(input);
    },
    async get(userId, documentId) {
      const rows = await db
        .select(columns)
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    list(userId) {
      return db
        .select(columns)
        .from(documents)
        .where(eq(documents.userId, userId))
        .orderBy(desc(documents.createdAt));
    },
    async delete(userId, documentId) {
      await db
        .delete(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
    },
    async markFailed(documentId, message) {
      await db
        .update(documents)
        .set({ status: 'failed', errorMessage: message, updatedAt: sql`now()` })
        .where(eq(documents.id, documentId));
    },
  };
}
