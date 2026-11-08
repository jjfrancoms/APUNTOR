import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/client';
import { documentChunks, documents, topics, usageQuotas } from '../../db/schema';
import type { AuthUsersDirectory } from './admin';
import type { AuthSession } from './auth';
import type { ConsentsRepository } from './consents';
import type { ConversationsRepository } from './conversations';
import type { DocumentsRepository } from './documents';
import { FREE_LIMITS, type QuotaService } from './quota';
import type { FileStorage } from './storage/file-storage';
import { summaryKey } from './topic-summary';
import type { WaitlistRepository } from './waitlist';

/*
 * Derecho de acceso (ARCO): todo lo que el servidor guarda del usuario, en un JSON. Cada consulta
 * filtra por `documents.user_id` o `user_id`; aquí nunca entra `file_path` ni los embeddings.
 * Los resúmenes de IA guardados en R2 se leen solo con las rutas de los documentos del usuario y
 * se copian a una lista cerrada de campos: ni claves de almacenamiento ni nombres de modelo.
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

const pagesSchema = z.array(z.number().int());
/** Lo que se exporta de cada bloque de un resumen. Zod descarta el resto (claves de figuras, etc.). */
const exportBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string() }),
  z.object({ type: z.literal('paragraph'), text: z.string(), pages: pagesSchema }),
  z.object({ type: z.literal('list'), items: z.array(z.string()), pages: pagesSchema }),
  z.object({
    type: z.literal('table'),
    caption: z.string().optional(),
    header: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    pages: pagesSchema,
  }),
  z.object({ type: z.literal('formula'), text: z.string(), pages: pagesSchema }),
  z.object({ type: z.literal('figure'), page: z.number().int(), caption: z.string() }),
]);
const storedSummaryExportSchema = z.object({ blocks: z.array(z.unknown()) });

export type ExportSummaryBlock = z.infer<typeof exportBlockSchema>;

export interface ExportSummary {
  topicId: string;
  blocks: ExportSummaryBlock[];
}

/** Cuántos resúmenes se leen de R2 a la vez. */
const SUMMARY_READ_CONCURRENCY = 8;

/** Resumen guardado de un tema, o `null` si falta, está dañado o no se puede leer. */
async function readSummary(
  storage: Pick<FileStorage, 'download'>,
  filePath: string,
  topicId: string,
): Promise<ExportSummary | null> {
  try {
    const raw: unknown = JSON.parse(
      new TextDecoder().decode(await storage.download(summaryKey(filePath, topicId))),
    );
    const stored = storedSummaryExportSchema.safeParse(raw);
    if (!stored.success) return null;
    const blocks = stored.data.blocks.flatMap((block) => {
      const parsed = exportBlockSchema.safeParse(block);
      return parsed.success ? [parsed.data] : [];
    });
    return blocks.length > 0 ? { topicId, blocks } : null;
  } catch {
    // Un archivo faltante o corrupto no debe romper la exportación.
    return null;
  }
}

/**
 * Resúmenes de IA guardados de los temas de UN documento del usuario, por tema. Solo se consultan
 * las rutas de los documentos que la sesión ya posee y los ids de temas que salen de sus propias filas.
 */
export async function readDocumentSummaries(
  storage: Pick<FileStorage, 'download'>,
  filePath: string,
  topicIds: readonly string[],
): Promise<ExportSummary[]> {
  const found: (ExportSummary | null)[] = [];
  for (let i = 0; i < topicIds.length; i += SUMMARY_READ_CONCURRENCY) {
    const batch = topicIds.slice(i, i + SUMMARY_READ_CONCURRENCY);
    found.push(...(await Promise.all(batch.map((id) => readSummary(storage, filePath, id)))));
  }
  return found.filter((summary): summary is ExportSummary => summary !== null);
}

export interface AccountExportDeps {
  documents: Pick<DocumentsRepository, 'list' | 'listCourses'>;
  /** Solo se lee (`download`) con las rutas de resúmenes de los documentos del usuario. */
  storage: Pick<FileStorage, 'download'>;
  consents: Pick<ConsentsRepository, 'list'>;
  conversations: Pick<ConversationsRepository, 'exportAll'>;
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
  const [courses, documents, consents, chunks, topicRows, quotas, usage, conversations] =
    await Promise.all([
      deps.documents.listCourses(userId),
      deps.documents.list(userId),
      deps.consents.list(userId),
      deps.accountExport.chunks(userId),
      deps.accountExport.topics(userId),
      deps.accountExport.quotas(userId),
      deps.quota.usage(userId),
      deps.conversations.exportAll(userId),
    ]);
  const verifiedEmail = identity?.emailConfirmedAt ? identity.email : null;
  const waitlist = verifiedEmail === null ? null : await deps.waitlist.findByEmail(verifiedEmail);
  const pages = groupChunksByPage(chunks);
  const summaries = new Map<string, ExportSummary[]>();
  for (const document of documents) {
    const topicIds = topicRows.filter((t) => t.documentId === document.id).map((t) => t.id);
    summaries.set(
      document.id,
      await readDocumentSummaries(deps.storage, document.filePath, topicIds),
    );
  }
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
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      course: conversation.course,
      scopeDocumentIds: conversation.scopeDocumentIds,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        kind: message.kind,
        text: message.text,
        payload: message.payload,
        createdAt: message.createdAt.toISOString(),
      })),
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
      aiSummaries: summaries.get(document.id) ?? [],
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
    // Lo que el servidor también guarda y no va aquí: los archivos subidos, los derivados en R2
    // que son imágenes (páginas y figuras recortadas de los resúmenes) o texto por página (ya va
    // en `pages`), los vectores, que no se pueden leer, y el detalle técnico de los fallos de
    // ingesta, que puede citar rutas internas. Los resúmenes de IA van en `aiSummaries`.
    notIncluded: [
      'uploaded_files',
      'page_images',
      'summary_figure_images',
      'embeddings',
      'ingestion_error_details',
    ],
  };
}
