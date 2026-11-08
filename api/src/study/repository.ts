import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import {
  courses,
  documentChunks,
  documents,
  studyItems,
  studyReviews,
  studySets,
  topics,
  type StudyItemPayload,
  type StudySetKind,
} from '../../../db/schema';
import type { StudySourceChunk, ValidStudyItem } from './generate';
import { addDays, daysUntilNext, nextBox } from './leitner';

/** Lo que devuelve el repaso de hoy: una cola razonable, no todo el historial. */
export const MAX_DUE_ITEMS = 200;
const MAX_LISTED_SETS = 100;

export interface StudySetRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  topicId: string | null;
  topicTitle: string | null;
  kind: StudySetKind;
  itemCount: number;
  lastScore: number | null;
  lastTotal: number | null;
  createdAt: Date;
}

export interface StudyItemRecord {
  id: string;
  chunkId: string;
  documentId: string;
  page: number;
  payload: StudyItemPayload;
}

export interface DueCardRecord extends StudyItemRecord {
  setId: string;
  documentTitle: string;
  courseId: string | null;
  courseTitle: string | null;
  box: number;
  dueDate: string;
}

export interface StudyRepository {
  /** Fragmentos del documento, en orden. Filtra por usuario, además de RLS. */
  sourceChunks(userId: string, documentId: string): Promise<StudySourceChunk[]>;
  /** Las tarjetas quedan para repasar hoy (`today`, AAAA-MM-DD). */
  createSet(input: {
    userId: string;
    documentId: string;
    topicId: string | null;
    kind: StudySetKind;
    items: readonly ValidStudyItem[];
    today: string;
  }): Promise<{ set: StudySetRecord; items: StudyItemRecord[] }>;
  listSets(
    userId: string,
    filter: { documentId?: string; kind?: StudySetKind },
  ): Promise<StudySetRecord[]>;
  getSet(
    userId: string,
    setId: string,
  ): Promise<{ set: StudySetRecord; items: StudyItemRecord[] } | null>;
  deleteSet(userId: string, setId: string): Promise<boolean>;
  recordResult(userId: string, setId: string, score: number, total: number): Promise<boolean>;
  /** Avanza o reinicia la caja. `null` si la tarjeta no existe, no es del usuario o es de un quiz. */
  review(
    userId: string,
    itemId: string,
    known: boolean,
    today: string,
  ): Promise<{ box: number; dueDate: string } | null>;
  dueToday(userId: string, today: string): Promise<DueCardRecord[]>;
}

const setColumns = {
  id: studySets.id,
  documentId: studySets.documentId,
  documentTitle: documents.title,
  topicId: studySets.topicId,
  topicTitle: topics.title,
  kind: studySets.kind,
  // La tabla va escrita: dentro de la subconsulta, `"id"` a secas sería el del elemento.
  itemCount:
    sql<number>`(SELECT count(*) FROM study_items i WHERE i.set_id = "study_sets"."id")`.mapWith(
      Number,
    ),
  lastScore: studySets.lastScore,
  lastTotal: studySets.lastTotal,
  createdAt: studySets.createdAt,
};

const itemColumns = {
  id: studyItems.id,
  chunkId: studyItems.chunkId,
  documentId: studySets.documentId,
  page: studyItems.page,
  payload: studyItems.payload,
};

/** Toda consulta filtra por usuario, además de RLS. */
export function createStudyRepository(db: Database): StudyRepository {
  async function findSet(userId: string, setId: string): Promise<StudySetRecord | null> {
    const rows = await db
      .select(setColumns)
      .from(studySets)
      .innerJoin(documents, eq(documents.id, studySets.documentId))
      .leftJoin(topics, eq(topics.id, studySets.topicId))
      .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  }

  function itemsOf(setId: string): Promise<StudyItemRecord[]> {
    return db
      .select(itemColumns)
      .from(studyItems)
      .innerJoin(studySets, eq(studySets.id, studyItems.setId))
      .where(eq(studyItems.setId, setId))
      .orderBy(asc(studyItems.position));
  }

  const repository: StudyRepository = {
    async sourceChunks(userId, documentId) {
      const rows = await db
        .select({
          id: documentChunks.id,
          documentId: documentChunks.documentId,
          pageNumber: documentChunks.pageNumber,
          chunkIndex: documentChunks.chunkIndex,
          content: documentChunks.content,
          sectionTitle: documentChunks.sectionTitle,
          metadata: documentChunks.metadata,
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documents.id, documentChunks.documentId))
        .where(and(eq(documentChunks.documentId, documentId), eq(documents.userId, userId)))
        .orderBy(asc(documentChunks.chunkIndex));
      return rows.map(({ metadata, ...chunk }) => ({
        ...chunk,
        similarity: 1,
        sectionPath: metadata.sectionPath,
      }));
    },

    async createSet(input) {
      const setId = await db.transaction(async (tx) => {
        const [set] = await tx
          .insert(studySets)
          .values({
            userId: input.userId,
            documentId: input.documentId,
            topicId: input.topicId,
            kind: input.kind,
          })
          .returning({ id: studySets.id });
        if (!set) throw new Error('No se pudo crear el conjunto');
        const items = await tx
          .insert(studyItems)
          .values(
            input.items.map((item, position) => ({
              setId: set.id,
              position,
              payload: item.payload,
              chunkId: item.citation.chunkId,
              page: item.citation.pageNumber,
            })),
          )
          .returning({ id: studyItems.id });
        if (input.kind === 'cards') {
          await tx.insert(studyReviews).values(
            items.map((item) => ({
              userId: input.userId,
              itemId: item.id,
              dueDate: input.today,
            })),
          );
        }
        return set.id;
      });
      const created = await repository.getSet(input.userId, setId);
      if (!created) throw new Error('El conjunto recién creado no aparece');
      return created;
    },

    listSets(userId, filter) {
      return db
        .select(setColumns)
        .from(studySets)
        .innerJoin(documents, eq(documents.id, studySets.documentId))
        .leftJoin(topics, eq(topics.id, studySets.topicId))
        .where(
          and(
            eq(studySets.userId, userId),
            filter.documentId === undefined
              ? undefined
              : eq(studySets.documentId, filter.documentId),
            filter.kind === undefined ? undefined : eq(studySets.kind, filter.kind),
          ),
        )
        .orderBy(desc(studySets.createdAt))
        .limit(MAX_LISTED_SETS);
    },

    async getSet(userId, setId) {
      const set = await findSet(userId, setId);
      return set ? { set, items: await itemsOf(setId) } : null;
    },

    async deleteSet(userId, setId) {
      const rows = await db
        .delete(studySets)
        .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
        .returning({ id: studySets.id });
      return rows.length > 0;
    },

    async recordResult(userId, setId, score, total) {
      const rows = await db
        .update(studySets)
        .set({ lastScore: score, lastTotal: total, lastPlayedAt: sql`now()` })
        .where(and(eq(studySets.id, setId), eq(studySets.userId, userId)))
        .returning({ id: studySets.id });
      return rows.length > 0;
    },

    review(userId, itemId, known, today) {
      return db.transaction(async (tx) => {
        const owned = await tx
          .select({ id: studyItems.id })
          .from(studyItems)
          .innerJoin(studySets, eq(studySets.id, studyItems.setId))
          .where(
            and(
              eq(studyItems.id, itemId),
              eq(studySets.userId, userId),
              eq(studySets.kind, 'cards'),
            ),
          )
          .limit(1);
        if (owned.length === 0) return null;

        await tx
          .insert(studyReviews)
          .values({ userId, itemId, dueDate: today })
          .onConflictDoNothing();
        // Bloquea la fila: dos respuestas seguidas no parten de la misma caja.
        const [current] = await tx
          .select({ box: studyReviews.box })
          .from(studyReviews)
          .where(and(eq(studyReviews.userId, userId), eq(studyReviews.itemId, itemId)))
          .for('update');
        if (!current) return null;

        const box = nextBox(current.box, known);
        const dueDate = addDays(today, daysUntilNext(box));
        await tx
          .update(studyReviews)
          .set({ box, dueDate, lastResult: known, updatedAt: sql`now()` })
          .where(and(eq(studyReviews.userId, userId), eq(studyReviews.itemId, itemId)));
        return { box, dueDate };
      });
    },

    dueToday(userId, today) {
      return db
        .select({
          ...itemColumns,
          setId: studyItems.setId,
          documentTitle: documents.title,
          courseId: documents.courseId,
          courseTitle: courses.title,
          box: studyReviews.box,
          dueDate: studyReviews.dueDate,
        })
        .from(studyReviews)
        .innerJoin(studyItems, eq(studyItems.id, studyReviews.itemId))
        .innerJoin(studySets, eq(studySets.id, studyItems.setId))
        .innerJoin(documents, eq(documents.id, studySets.documentId))
        .leftJoin(courses, eq(courses.id, documents.courseId))
        .where(
          and(
            eq(studyReviews.userId, userId),
            eq(studySets.userId, userId),
            lte(studyReviews.dueDate, today),
          ),
        )
        .orderBy(asc(studyReviews.dueDate), asc(studySets.createdAt), asc(studyItems.position))
        .limit(MAX_DUE_ITEMS);
    },
  };
  return repository;
}
