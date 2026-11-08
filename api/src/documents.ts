import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  consents,
  courses,
  documentChunks,
  documents,
  topics,
  type DocumentStatus,
} from '../../db/schema';
import { buildTopicContent, type TopicContent } from './topic-content';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_COURSE_TITLE = 80;

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
  courseId: string | null;
  title: string;
  filePath: string;
  sizeBytes: number;
  status: DocumentStatus;
  totalPages: number | null;
  /** Temas detectados en los encabezados (los cuenta el servidor, no la app). */
  topicCount: number;
  createdAt: Date;
}

export interface CourseRecord {
  id: string;
  title: string;
  createdAt: Date;
}

export interface TopicRecord {
  id: string;
  parentId: string | null;
  title: string;
  sourcePages: number[];
}

export interface DocumentsRepository {
  create(input: {
    id: string;
    userId: string;
    courseId: string | null;
    title: string;
    filePath: string;
    sizeBytes: number;
  }): Promise<void>;
  get(userId: string, documentId: string): Promise<DocumentRecord | null>;
  list(userId: string): Promise<DocumentRecord[]>;
  update(
    userId: string,
    documentId: string,
    patch: { title?: string; courseId?: string | null },
  ): Promise<void>;
  delete(userId: string, documentId: string): Promise<void>;
  markFailed(documentId: string, message: string): Promise<void>;
  topics(userId: string, documentId: string): Promise<TopicRecord[]>;
  /** Texto del documento bajo un tema, por página (null si el tema no es de ese documento). */
  topicContent(userId: string, documentId: string, topicId: string): Promise<TopicContent | null>;
  listCourses(userId: string): Promise<CourseRecord[]>;
  getCourse(userId: string, courseId: string): Promise<CourseRecord | null>;
  createCourse(userId: string, title: string): Promise<CourseRecord>;
  renameCourse(userId: string, courseId: string, title: string): Promise<void>;
  deleteCourse(userId: string, courseId: string): Promise<void>;
  /** Borra cursos, documentos (con fragmentos y temas), cuotas y consentimientos del usuario. */
  deleteAllForUser(userId: string): Promise<void>;
}

const documentColumns = {
  id: documents.id,
  courseId: documents.courseId,
  title: documents.title,
  filePath: documents.filePath,
  sizeBytes: documents.sizeBytes,
  status: documents.status,
  totalPages: documents.totalPages,
  // La tabla va escrita: Drizzle pondría `"id"` a secas y, dentro de la subconsulta,
  // Postgres lo leería como el id del tema (el conteo daría siempre 0).
  topicCount:
    sql<number>`(SELECT count(*) FROM topics t WHERE t.document_id = "documents"."id")`.mapWith(
      Number,
    ),
  createdAt: documents.createdAt,
};

const courseColumns = { id: courses.id, title: courses.title, createdAt: courses.createdAt };

/** Toda consulta filtra por usuario, además de RLS. */
export function createDocumentsRepository(db: Database): DocumentsRepository {
  const repository: DocumentsRepository = {
    async create(input) {
      await db.insert(documents).values(input);
    },
    async get(userId, documentId) {
      const rows = await db
        .select(documentColumns)
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    list(userId) {
      return db
        .select(documentColumns)
        .from(documents)
        .where(eq(documents.userId, userId))
        .orderBy(desc(documents.createdAt));
    },
    async update(userId, documentId, patch) {
      await db
        .update(documents)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
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
    topics(userId, documentId) {
      return db
        .select({
          id: topics.id,
          parentId: topics.parentTopicId,
          title: topics.title,
          sourcePages: topics.sourcePages,
        })
        .from(topics)
        .innerJoin(documents, eq(documents.id, topics.documentId))
        .where(and(eq(topics.documentId, documentId), eq(documents.userId, userId)))
        .orderBy(asc(topics.createdAt));
    },
    async topicContent(userId, documentId, topicId) {
      const rows = await repository.topics(userId, documentId);
      if (!rows.some((t) => t.id === topicId)) return null;
      const chunks = await db
        .select({
          pageNumber: documentChunks.pageNumber,
          chunkIndex: documentChunks.chunkIndex,
          content: documentChunks.content,
          metadata: documentChunks.metadata,
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documents.id, documentChunks.documentId))
        .where(and(eq(documentChunks.documentId, documentId), eq(documents.userId, userId)))
        .orderBy(asc(documentChunks.chunkIndex));
      return buildTopicContent(
        rows,
        chunks.map((c) => ({
          pageNumber: c.pageNumber,
          chunkIndex: c.chunkIndex,
          content: c.content,
          sectionPath: c.metadata.sectionPath,
          charStart: c.metadata.charStart,
          charEnd: c.metadata.charEnd,
        })),
        topicId,
      );
    },
    listCourses(userId) {
      return db
        .select(courseColumns)
        .from(courses)
        .where(eq(courses.userId, userId))
        .orderBy(asc(courses.createdAt));
    },
    async getCourse(userId, courseId) {
      const rows = await db
        .select(courseColumns)
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
        .limit(1);
      return rows[0] ?? null;
    },
    async createCourse(userId, title) {
      const rows = await db.insert(courses).values({ userId, title }).returning(courseColumns);
      const row = rows[0];
      if (!row) throw new Error('No se pudo crear el curso');
      return row;
    },
    async renameCourse(userId, courseId, title) {
      await db
        .update(courses)
        .set({ title })
        .where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
    },
    async deleteCourse(userId, courseId) {
      await db.delete(courses).where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
    },
    async deleteAllForUser(userId) {
      await db.transaction(async (tx) => {
        await tx.delete(documents).where(eq(documents.userId, userId));
        await tx.delete(courses).where(eq(courses.userId, userId));
        await tx.execute(sql`DELETE FROM usage_quotas WHERE user_id = ${userId}::uuid`);
        await tx.delete(consents).where(eq(consents.userId, userId));
      });
    },
  };
  return repository;
}
