import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  classificationCorrections,
  consents,
  conversations,
  courses,
  documentChunks,
  documents,
  studyReviews,
  studySets,
  topics,
  type ClassificationStatus,
  type DocumentStatus,
} from '../../db/schema';
import { buildTopicContent, type TopicContent } from './topic-content';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_COURSE_TITLE = 80;

/** Formatos del README: PDF, PPTX, DOCX, texto (TXT y Markdown) y fotos. */
export const UPLOAD_CONTENT_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

/** Dos títulos de curso son el mismo si solo cambian mayúsculas o espacios. */
export function sameCourseTitle(a: string, b: string): boolean {
  const normalize = (title: string): string => title.trim().replace(/\s+/gu, ' ').toLowerCase();
  return normalize(a) === normalize(b);
}

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
  /** Curso que propone la IA; con `null` y título, la propuesta es crear ese curso. */
  suggestedCourseId: string | null;
  suggestedCourseTitle: string | null;
  suggestionConfidence: number | null;
  suggestionReason: string | null;
  classificationStatus: ClassificationStatus;
  createdAt: Date;
}

/** Lo que decide el usuario sobre la sugerencia de curso. */
export type ClassificationDecision =
  { status: 'confirmed'; courseId: string; recordCorrection: boolean } | { status: 'dismissed' };

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
  /** Aplica la decisión del usuario y, si corrigió a la IA, guarda la corrección. */
  applyClassification(
    userId: string,
    documentId: string,
    decision: ClassificationDecision,
  ): Promise<void>;
  topics(userId: string, documentId: string): Promise<TopicRecord[]>;
  /** Texto del documento bajo un tema, por página (null si el tema no es de ese documento). */
  topicContent(userId: string, documentId: string, topicId: string): Promise<TopicContent | null>;
  listCourses(userId: string): Promise<CourseRecord[]>;
  getCourse(userId: string, courseId: string): Promise<CourseRecord | null>;
  createCourse(userId: string, title: string): Promise<CourseRecord>;
  renameCourse(userId: string, courseId: string, title: string): Promise<void>;
  deleteCourse(userId: string, courseId: string): Promise<void>;
  /** Borra cursos, documentos (con fragmentos y temas), estudio, cuotas, consentimientos y conversaciones. */
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
  suggestedCourseId: documents.suggestedCourseId,
  // El nombre actual del curso si se renombró; si se borró, el nombre con el que se propuso.
  suggestedCourseTitle: sql<
    string | null
  >`COALESCE((SELECT c.title FROM courses c WHERE c.id = "documents"."suggested_course_id"), "documents"."suggested_course_title")`,
  suggestionConfidence: documents.suggestionConfidence,
  suggestionReason: documents.suggestionReason,
  classificationStatus: documents.classificationStatus,
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
    async applyClassification(userId, documentId, decision) {
      await db.transaction(async (tx) => {
        await tx
          .update(documents)
          .set(
            decision.status === 'confirmed'
              ? {
                  courseId: decision.courseId,
                  classificationStatus: 'confirmed',
                  updatedAt: sql`now()`,
                }
              : { classificationStatus: 'dismissed', updatedAt: sql`now()` },
          )
          .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
        if (decision.status === 'confirmed' && decision.recordCorrection) {
          await tx
            .insert(classificationCorrections)
            .values({ userId, documentId, courseId: decision.courseId })
            .onConflictDoUpdate({
              target: classificationCorrections.documentId,
              set: { courseId: decision.courseId, createdAt: sql`now()` },
            });
        }
      });
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
        // Las correcciones a la IA son datos del usuario: se borran con la cuenta.
        await tx
          .delete(classificationCorrections)
          .where(eq(classificationCorrections.userId, userId));
        // Antes que los documentos: los conjuntos arrastran sus elementos y repasos.
        await tx.delete(studyReviews).where(eq(studyReviews.userId, userId));
        await tx.delete(studySets).where(eq(studySets.userId, userId));
        await tx.delete(documents).where(eq(documents.userId, userId));
        await tx.delete(courses).where(eq(courses.userId, userId));
        await tx.execute(sql`DELETE FROM usage_quotas WHERE user_id = ${userId}::uuid`);
        await tx.delete(consents).where(eq(consents.userId, userId));
        // Los mensajes se van con su conversación (ON DELETE CASCADE).
        await tx.delete(conversations).where(eq(conversations.userId, userId));
      });
    },
  };
  return repository;
}
