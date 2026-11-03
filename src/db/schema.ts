import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * Dimensión de los embeddings. Debe coincidir con el modelo configurado
 * (gemini-embedding con salida de 768 dims según la especificación v2.4).
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

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    title: text('title').notNull(),
    filePath: text('file_path').notNull(),
    totalPages: integer('total_pages'),
    status: documentStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_user_id_idx').on(t.userId),
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

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
