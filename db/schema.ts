import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * Dimensión de los embeddings. Debe coincidir con el modelo configurado
 * (gemini-embedding-2 con salida de 768 dims según la especificación v2.4).
 * Cambiarla exige una migración nueva y re-vectorizar todos los chunks.
 */
export const EMBEDDING_DIMENSIONS = 768;

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];

/** Cursos que crea el usuario. La clasificación automática llegará después (fase 2). */
export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('courses_user_id_idx').on(t.userId),
    check('courses_title_not_empty', sql`length(trim(${t.title})) > 0`),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    /** Sin curso mientras el usuario no lo confirme; si se borra el curso, el documento queda. */
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    filePath: text('file_path').notNull(),
    /** Tamaño declarado y verificado contra R2; se descuenta de la cuota al borrar. */
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    totalPages: integer('total_pages'),
    status: documentStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_user_id_idx').on(t.userId),
    index('documents_course_id_idx').on(t.courseId),
    index('documents_status_idx').on(t.status),
    check('documents_total_pages_positive', sql`${t.totalPages} IS NULL OR ${t.totalPages} > 0`),
  ],
);

/** Metadatos de sección conservados por chunk para citas verificables. */
export interface ChunkSectionMetadata {
  /** Ruta jerárquica de encabezados detectados, de más general a más específico. */
  sectionPath: string[];
  /** Offset de caracteres dentro del texto normalizado de la página. */
  charStart: number;
  charEnd: number;
}

export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull(),
    sectionTitle: text('section_title'),
    metadata: jsonb('metadata').$type<ChunkSectionMetadata>().notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('document_chunks_document_chunk_idx').on(t.documentId, t.chunkIndex),
    index('document_chunks_document_page_idx').on(t.documentId, t.pageNumber),
    index('document_chunks_embedding_hnsw_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    check('document_chunks_page_number_positive', sql`${t.pageNumber} >= 1`),
    check('document_chunks_chunk_index_non_negative', sql`${t.chunkIndex} >= 0`),
  ],
);

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    parentTopicId: uuid('parent_topic_id').references((): AnyPgColumn => topics.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    summary: text('summary'),
    sourcePages: integer('source_pages')
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('topics_document_id_idx').on(t.documentId),
    index('topics_parent_topic_id_idx').on(t.parentTopicId),
    check(
      'topics_not_own_parent',
      sql`${t.parentTopicId} IS NULL OR ${t.parentTopicId} <> ${t.id}`,
    ),
  ],
);

/**
 * Cuotas por usuario y periodo. Solo se modifican con las funciones atómicas
 * `consume_quota` y `release_quota` (db/migrations), nunca con lectura + escritura.
 */
export const usageQuotas = pgTable(
  'usage_quotas',
  {
    userId: uuid('user_id').notNull(),
    /** Qué se mide: 'questions' (por día) o 'storage_bytes' (acumulado). */
    kind: text('kind').notNull(),
    /** Inicio del periodo; el acumulado usa una fecha fija. */
    periodStart: date('period_start').notNull(),
    used: bigint('used', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.kind, t.periodStart] }),
    check('usage_quotas_used_non_negative', sql`${t.used} >= 0`),
    check('usage_quotas_kind_valid', sql`${t.kind} IN ('questions', 'storage_bytes', 'summaries')`),
  ],
);

export const CONSENT_DOCUMENTS = ['terms', 'privacy'] as const;
export type ConsentDocument = (typeof CONSENT_DOCUMENTS)[number];

/**
 * Aceptación de los términos y de la política de privacidad, una fila por versión aceptada.
 * Solo la escribe el backend; el usuario autenticado lee las suyas (RLS).
 */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    document: text('document').$type<ConsentDocument>().notNull(),
    version: text('version').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('consents_user_document_version_idx').on(t.userId, t.document, t.version),
    check('consents_document_valid', sql`${t.document} IN ('terms', 'privacy')`),
  ],
);

/**
 * Registro de las acciones del panel de administrador que cambian algo (reintentos, borrados).
 * Solo lo escribe y lee el backend: RLS habilitada y sin políticas para authenticated ni anon.
 * Guarda metadatos, nunca contenido de documentos ni preguntas.
 */
export const adminAudit = pgTable(
  'admin_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: uuid('admin_user_id').notNull(),
    adminEmail: text('admin_email').notNull(),
    /** Qué hizo, p. ej. `document.retry` o `user.delete`. */
    action: text('action').notNull(),
    /** Sobre qué lo hizo, p. ej. `document:<id>` o `user:<id>`. */
    target: text('target').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('admin_audit_created_at_idx').on(t.createdAt)],
);

export type Course = typeof courses.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type Consent = typeof consents.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type AdminAuditEntry = typeof adminAudit.$inferSelect;
