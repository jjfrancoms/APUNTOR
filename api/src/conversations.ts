import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Database } from '../../db/client';
import {
  CONVERSATION_MESSAGE_KINDS,
  CONVERSATION_MESSAGE_ROLES,
  conversationMessages,
  conversations,
  type ConversationMessageKind,
  type ConversationMessagePayload,
  type ConversationMessageRole,
} from '../../db/schema';
import { ApiError } from './errors';

/*
 * Conversaciones guardadas en el servidor (fase 2). Una sola vía de escritura: la app genera los
 * ids (uuid) y sube los mensajes aquí cuando los tiene, también los que nunca pasan por
 * /v1/questions (contexto externo, avisos de límite o cancelación). `POST /v1/questions` no
 * guarda nada: así un reintento o una edición no dejan copias, y lo que se escribió sin conexión
 * entra igual. Ningún log incluye títulos ni mensajes (ver `api/src/logging.ts`).
 */

export const MAX_MESSAGES_PER_BATCH = 100;
export const MAX_MESSAGE_TEXT = 20_000;
const MAX_TITLE = 200;
const MAX_SCOPE_DOCUMENTS = 100;
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;
/** Un lote de respuestas con citas supera el límite general de 64 KB de la API. */
const MESSAGES_BODY_LIMIT = 1024 * 1024;

export interface ConversationSummary {
  id: string;
  title: string;
  course: string;
  scopeDocumentIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export interface ConversationMessageInput {
  id: string;
  role: ConversationMessageRole;
  kind: ConversationMessageKind;
  text: string;
  payload: ConversationMessagePayload;
}

export interface ConversationMessageRecord extends ConversationMessageInput {
  createdAt: Date;
}

export interface ConversationPatch {
  title?: string;
  course?: string;
  scopeDocumentIds?: string[] | null;
}

export interface ConversationsRepository {
  /** De la más reciente a la más antigua. */
  list(userId: string, page: { limit: number; offset: number }): Promise<ConversationSummary[]>;
  get(
    userId: string,
    id: string,
  ): Promise<(ConversationSummary & { messages: ConversationMessageRecord[] }) | null>;
  /**
   * Idempotente: si ya existe devuelve la conversación tal como está. `null` si ese id
   * pertenece a otro usuario (la ruta responde como si no existiera).
   */
  create(
    userId: string,
    input: {
      id: string;
      title: string;
      course: string;
      scopeDocumentIds: string[] | null;
      updatedAt: Date | null;
    },
  ): Promise<ConversationSummary | null>;
  update(userId: string, id: string, patch: ConversationPatch): Promise<ConversationSummary | null>;
  /** Idempotente por id de mensaje. `null` si la conversación no es del usuario. */
  appendMessages(
    userId: string,
    id: string,
    messages: readonly ConversationMessageInput[],
    updatedAt: Date | null,
  ): Promise<ConversationSummary | null>;
  deleteMessages(
    userId: string,
    id: string,
    messageIds: readonly string[],
  ): Promise<ConversationSummary | null>;
  /** Borrar lo que ya no existe no es un error (la app reintenta sin saber si llegó). */
  delete(userId: string, id: string): Promise<void>;
}

const summaryColumns = {
  id: conversations.id,
  title: conversations.title,
  course: conversations.course,
  scopeDocumentIds: conversations.scopeDocumentIds,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt,
  // La tabla va escrita para que, dentro de la subconsulta, "id" no sea el del mensaje.
  messageCount:
    sql<number>`(SELECT count(*) FROM conversation_messages m WHERE m.conversation_id = "conversations"."id")`.mapWith(
      Number,
    ),
};

/** El reloj del teléfono puede estar adelantado: nunca se guarda una fecha futura. */
function notAfterNow(date: Date) {
  return sql`LEAST(${date.toISOString()}::timestamptz, now())`;
}

/** Toda consulta filtra por usuario, además de RLS. El borrado va en `deleteAllForUser`. */
export function createConversationsRepository(db: Database): ConversationsRepository {
  async function summary(userId: string, id: string): Promise<ConversationSummary | null> {
    const rows = await db
      .select(summaryColumns)
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async function owns(userId: string, id: string): Promise<boolean> {
    const rows = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .limit(1);
    return rows.length > 0;
  }

  return {
    list(userId, { limit, offset }) {
      return db
        .select(summaryColumns)
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt), desc(conversations.id))
        .limit(limit)
        .offset(offset);
    },

    async get(userId, id) {
      const found = await summary(userId, id);
      if (!found) return null;
      const messages = await db
        .select({
          id: conversationMessages.id,
          role: conversationMessages.role,
          kind: conversationMessages.kind,
          text: conversationMessages.text,
          payload: conversationMessages.payload,
          createdAt: conversationMessages.createdAt,
        })
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, id))
        .orderBy(asc(conversationMessages.seq));
      return { ...found, messages };
    },

    async create(userId, input) {
      const stamp = input.updatedAt === null ? sql`now()` : notAfterNow(input.updatedAt);
      await db
        .insert(conversations)
        .values({
          id: input.id,
          userId,
          title: input.title,
          course: input.course,
          scopeDocumentIds: input.scopeDocumentIds,
          createdAt: stamp,
          updatedAt: stamp,
        })
        .onConflictDoNothing({ target: conversations.id });
      return summary(userId, input.id);
    },

    async update(userId, id, patch) {
      await db
        .update(conversations)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
      return summary(userId, id);
    },

    async appendMessages(userId, id, messages, updatedAt) {
      const done = await db.transaction(async (tx) => {
        // El bloqueo mantiene el orden de `seq` cuando dos lotes llegan a la vez.
        const owned = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
          .for('update');
        if (owned.length === 0) return false;
        if (messages.length > 0) {
          await tx
            .insert(conversationMessages)
            .values(messages.map((message) => ({ ...message, conversationId: id })))
            .onConflictDoNothing({
              target: [conversationMessages.conversationId, conversationMessages.id],
            });
        }
        const stamp = updatedAt === null ? sql`now()` : notAfterNow(updatedAt);
        await tx
          .update(conversations)
          .set({ updatedAt: sql`GREATEST(${conversations.updatedAt}, ${stamp})` })
          .where(eq(conversations.id, id));
        return true;
      });
      return done ? summary(userId, id) : null;
    },

    async deleteMessages(userId, id, messageIds) {
      if (!(await owns(userId, id))) return null;
      await db
        .delete(conversationMessages)
        .where(
          and(
            eq(conversationMessages.conversationId, id),
            inArray(conversationMessages.id, [...messageIds]),
          ),
        );
      // Avanza la fecha para que otros dispositivos noten el cambio.
      await db
        .update(conversations)
        .set({ updatedAt: sql`now()` })
        .where(eq(conversations.id, id));
      return summary(userId, id);
    },

    async delete(userId, id) {
      await db
        .delete(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    },
  };
}

// --- Rutas -----------------------------------------------------------------------------

const idParams = z.object({ id: z.uuid() });
const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});
const title = z.string().trim().max(MAX_TITLE);
const course = z.string().trim().max(MAX_TITLE);
const scopeDocumentIds = z.array(z.uuid()).max(MAX_SCOPE_DOCUMENTS);
const clientDate = z.iso.datetime({ offset: true });

const createBody = z.object({
  id: z.uuid(),
  title: title.default(''),
  course: course.default(''),
  scopeDocumentIds: scopeDocumentIds.nullable().default(null),
  updatedAt: clientDate.optional(),
});
const patchBody = z
  .object({
    title: title.optional(),
    course: course.optional(),
    scopeDocumentIds: scopeDocumentIds.nullable().optional(),
  })
  .refine(
    (body) =>
      body.title !== undefined || body.course !== undefined || body.scopeDocumentIds !== undefined,
  );

const pageRef = z.object({ documentId: z.string().max(64), page: z.number().int().min(1) });
/** Solo se guardan estos campos: lo desconocido se descarta al validar. */
const messagePayload = z.object({
  claims: z
    .array(
      z.object({
        label: z.string().max(500).optional(),
        formula: z.string().max(500).optional(),
        text: z.string().max(4000),
        pages: z.array(pageRef).max(50),
      }),
    )
    .max(50)
    .optional(),
  sources: z
    .array(
      z.object({
        page: z.number().int().min(1),
        klass: z.number().int().min(0),
        documentId: z.string().max(64),
      }),
    )
    .max(200)
    .optional(),
  reason: z.enum(['empty_question', 'no_matches', 'validation_failed']).optional(),
  unclear: z.boolean().optional(),
  errorCode: z.enum(['TIMEOUT', 'NETWORK', 'RATE_LIMITED', 'CHAT_FAILED']).optional(),
  smallTalk: z.enum(['greeting', 'thanks', 'identity', 'farewell']).optional(),
  external: z
    .object({
      title: z.string().max(500),
      host: z.string().max(255),
      url: z.string().max(2048).optional(),
    })
    .optional(),
});
const appendBody = z.object({
  messages: z
    .array(
      z.object({
        id: z.uuid(),
        role: z.enum(CONVERSATION_MESSAGE_ROLES),
        kind: z.enum(CONVERSATION_MESSAGE_KINDS),
        text: z.string().max(MAX_MESSAGE_TEXT).default(''),
        payload: messagePayload.default({}),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES_PER_BATCH),
  updatedAt: clientDate.optional(),
});
const deleteMessagesBody = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('REQ_INVALID', 400);
  return parsed.data;
}

function toPublicSummary(conversation: ConversationSummary) {
  return {
    id: conversation.id,
    title: conversation.title,
    course: conversation.course,
    scopeDocumentIds: conversation.scopeDocumentIds,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messageCount: conversation.messageCount,
  };
}

function found<T>(value: T | null): T {
  if (value === null) throw new ApiError('CONV_NOT_FOUND', 404);
  return value;
}

/** Rutas `/v1/conversations`; usan el límite global de peticiones. */
export function registerConversationRoutes(
  app: FastifyInstance,
  deps: {
    conversations: ConversationsRepository;
    requireUser: (request: FastifyRequest) => Promise<string>;
  },
): void {
  const { conversations: repository, requireUser } = deps;

  app.get('/v1/conversations', async (request) => {
    const userId = await requireUser(request);
    const { page, perPage } = parse(listQuery, request.query);
    const rows = await repository.list(userId, {
      limit: perPage + 1,
      offset: (page - 1) * perPage,
    });
    return {
      conversations: rows.slice(0, perPage).map(toPublicSummary),
      page,
      hasMore: rows.length > perPage,
    };
  });

  app.get('/v1/conversations/:id', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const conversation = found(await repository.get(userId, id));
    return {
      ...toPublicSummary(conversation),
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        kind: message.kind,
        text: message.text,
        payload: message.payload,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  });

  app.post('/v1/conversations', async (request, reply) => {
    const userId = await requireUser(request);
    const body = parse(createBody, request.body);
    const conversation = found(
      await repository.create(userId, {
        id: body.id,
        title: body.title,
        course: body.course,
        scopeDocumentIds: body.scopeDocumentIds,
        updatedAt: body.updatedAt === undefined ? null : new Date(body.updatedAt),
      }),
    );
    return reply.status(201).send(toPublicSummary(conversation));
  });

  app.patch('/v1/conversations/:id', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const body = parse(patchBody, request.body);
    return toPublicSummary(
      found(
        await repository.update(userId, id, {
          ...(body.title === undefined ? {} : { title: body.title }),
          ...(body.course === undefined ? {} : { course: body.course }),
          ...(body.scopeDocumentIds === undefined
            ? {}
            : { scopeDocumentIds: body.scopeDocumentIds }),
        }),
      ),
    );
  });

  app.post('/v1/conversations/:id/messages', { bodyLimit: MESSAGES_BODY_LIMIT }, async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const body = parse(appendBody, request.body);
    return toPublicSummary(
      found(
        await repository.appendMessages(
          userId,
          id,
          body.messages,
          body.updatedAt === undefined ? null : new Date(body.updatedAt),
        ),
      ),
    );
  });

  // Editar la última pregunta o reintentar quita mensajes: es un POST porque lleva cuerpo.
  app.post('/v1/conversations/:id/messages/delete', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const { ids } = parse(deleteMessagesBody, request.body);
    return toPublicSummary(found(await repository.deleteMessages(userId, id, ids)));
  });

  app.delete('/v1/conversations/:id', async (request, reply) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    await repository.delete(userId, id);
    return reply.status(204).send();
  });
}

/** Conteos por usuario para el panel: nunca títulos ni mensajes. */
export async function conversationCounts(
  db: Database,
  userIds: readonly string[],
): Promise<Map<string, { conversations: number; messages: number }>> {
  const result = new Map<string, { conversations: number; messages: number }>();
  if (userIds.length === 0) return result;
  const rows = await db
    .select({
      userId: conversations.userId,
      conversations: sql<number>`count(DISTINCT ${conversations.id})`.mapWith(Number),
      messages: count(conversationMessages.id).mapWith(Number),
    })
    .from(conversations)
    .leftJoin(conversationMessages, eq(conversationMessages.conversationId, conversations.id))
    .where(inArray(conversations.userId, [...userIds]))
    .groupBy(conversations.userId);
  for (const row of rows) {
    result.set(row.userId, { conversations: row.conversations, messages: row.messages });
  }
  return result;
}
