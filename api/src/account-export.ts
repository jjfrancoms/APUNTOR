import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { documentChunks, documents, topics, usageQuotas } from '../../db/schema';
import type { AuthUsersDirectory } from './admin';
import type { AuthSession } from './auth';
import type { ConsentsRepository } from './consents';
import type { DocumentsRepository } from './documents';
import { FREE_LIMITS, type QuotaService } from './quota';
import type { WaitlistRepository } from './waitlist';

/*
 * Derecho de acceso (ARCO): todo lo que el servidor guarda del usuario, en un JSON. Cada consulta
 * filtra por `documents.user_id` o `user_id`; aquí nunca entra `file_path` ni los embeddings.
 */

export interface ExportChunkRecord {
  documentId: string;
  pageNumber: number;
  chunkIndex: number;
  sectionTitle: string | null;
  content: string;
}

export interface ExportTopicRecord {
  id: string;
  documentId: string;
  parentId: string | null;
  title: string;
  summary: string | null;
  sourcePages: number[];
}

export interface ExportQuotaRecord {
  kind: string;
  periodStart: string;
  used: number;
}

/** Lo que solo hace falta para la exportación. Inyectado para probarlo sin base de datos. */
export interface AccountExportRepository {
  /** Texto de los fragmentos del usuario, por documento, página y orden. Sin embeddings. */
  chunks(userId: string): Promise<ExportChunkRecord[]>;
  topics(userId: string): Promise<ExportTopicRecord[]>;
  quotas(userId: string): Promise<ExportQuotaRecord[]>;
}

export function createAccountExportRepository(db: Database): AccountExportRepository {
  return {
    chunks(userId) {
      return db
        .select({
          documentId: documentChunks.documentId,
          pageNumber: documentChunks.pageNumber,
          chunkIndex: documentChunks.chunkIndex,
          sectionTitle: documentChunks.sectionTitle,
          content: documentChunks.content,
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documents.id, documentChunks.documentId))
        .where(eq(documents.userId, userId))
        .orderBy(
          asc(documentChunks.documentId),
          asc(documentChunks.pageNumber),
          asc(documentChunks.chunkIndex),
        );
    },
    topics(userId) {
      return db
        .select({
          id: topics.id,
          documentId: topics.documentId,
          parentId: topics.parentTopicId,
          title: topics.title,
          summary: topics.summary,
          sourcePages: topics.sourcePages,
        })
        .from(topics)
        .innerJoin(documents, eq(documents.id, topics.documentId))
        .where(eq(documents.userId, userId))
        .orderBy(asc(topics.createdAt));
    },
    quotas(userId) {
      return db
        .select({
          kind: usageQuotas.kind,
          periodStart: usageQuotas.periodStart,
          used: usageQuotas.used,
        })
        .from(usageQuotas)
        .where(eq(usageQuotas.userId, userId))
        .orderBy(asc(usageQuotas.periodStart), asc(usageQuotas.kind));
    },
  };
}

export interface ExportPage {
  pageNumber: number;
  chunks: { chunkIndex: number; sectionTitle: string | null; text: string }[];
}

/** Agrupa por documento y página, respetando el orden de lectura. */
export function groupChunksByPage(chunks: readonly ExportChunkRecord[]): Map<string, ExportPage[]> {
  const byDocument = new Map<string, ExportPage[]>();
  for (const chunk of chunks) {
    const pages = byDocument.get(chunk.documentId) ?? [];
    let page = pages.at(-1);
    if (page?.pageNumber !== chunk.pageNumber) {
      page = { pageNumber: chunk.pageNumber, chunks: [] };
      pages.push(page);
    }
    page.chunks.push({
      chunkIndex: chunk.chunkIndex,
      sectionTitle: chunk.sectionTitle,
      text: chunk.content,
    });
    byDocument.set(chunk.documentId, pages);
  }
  return byDocument;
}

export interface AccountExportDeps {
  documents: Pick<DocumentsRepository, 'list' | 'listCourses'>;
  consents: Pick<ConsentsRepository, 'list'>;
  accountExport: AccountExportRepository;
  quota: Pick<QuotaService, 'usage'>;
  waitlist: Pick<WaitlistRepository, 'findByEmail'>;
  authUsers: Pick<AuthUsersDirectory, 'get'>;
}

/**
 * Correo confirmado de la cuenta según la Admin API, o `null`. El claim del JWT no basta para
 * ligar la cuenta a una fila de la lista de espera, que no tiene dueño: solo el correo confirmado
 * demuestra que esa dirección es de esta persona.
 */
export async function confirmedEmail(
  authUsers: Pick<AuthUsersDirectory, 'get'>,
  userId: string,
): Promise<string | null> {
  const identity = await authUsers.get(userId);
  return identity?.emailConfirmedAt ? identity.email : null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function buildAccountExport(deps: AccountExportDeps, session: AuthSession) {
  const { userId } = session;
  // Antes que nada: si Supabase no responde, se reintenta sin haber leído el contenido.
  const identity = await deps.authUsers.get(userId);
  const [courses, documents, consents, chunks, topicRows, quotas, usage] = await Promise.all([
    deps.documents.listCourses(userId),
    deps.documents.list(userId),
    deps.consents.list(userId),
    deps.accountExport.chunks(userId),
    deps.accountExport.topics(userId),
    deps.accountExport.quotas(userId),
    deps.quota.usage(userId),
  ]);
  const verifiedEmail = identity?.emailConfirmedAt ? identity.email : null;
  const waitlist = verifiedEmail === null ? null : await deps.waitlist.findByEmail(verifiedEmail);
  const pages = groupChunksByPage(chunks);
  // Lista cerrada: `user_metadata` también trae datos del proveedor que no se reenvían a ciegas.
  const metadata = identity?.metadata ?? {};

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: userId,
      email: identity?.email ?? session.email,
      createdAt: identity?.createdAt?.toISOString() ?? null,
      fullName: textOrNull(metadata.full_name) ?? textOrNull(metadata.name),
      level: textOrNull(metadata.level),
      adultConfirmed: metadata.adult_confirmed === true,
    },
    consents: consents.map((consent) => ({
      document: consent.document,
      version: consent.version,
      acceptedAt: consent.acceptedAt.toISOString(),
    })),
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      createdAt: course.createdAt.toISOString(),
    })),
    documents: documents.map((document) => ({
      id: document.id,
      courseId: document.courseId,
      title: document.title,
      sizeBytes: document.sizeBytes,
      status: document.status,
      totalPages: document.totalPages,
      createdAt: document.createdAt.toISOString(),
      topics: topicRows
        .filter((topic) => topic.documentId === document.id)
        .map(({ documentId: _documentId, ...topic }) => topic),
      pages: pages.get(document.id) ?? [],
    })),
    usage: {
      questionsToday: usage.questions,
      questionsLimit: FREE_LIMITS.questions,
      storageBytes: usage.storage_bytes,
      storageLimit: FREE_LIMITS.storage_bytes,
      periods: quotas,
    },
    waitlist:
      waitlist === null
        ? null
        : {
            email: waitlist.email,
            consent: waitlist.consent,
            source: waitlist.source,
            createdAt: waitlist.createdAt.toISOString(),
          },
    // Lo que el servidor también guarda y no va aquí: los archivos subidos y los derivados en
    // R2 (imágenes de página, texto por página, resúmenes de IA), los vectores, que no se pueden
    // leer, y el detalle técnico de los fallos de ingesta, que puede citar rutas internas.
    notIncluded: ['uploaded_files', 'derived_files', 'embeddings', 'ingestion_error_details'],
  };
}
