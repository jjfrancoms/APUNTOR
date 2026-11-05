import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Authenticator } from './auth';
import {
  extensionOf,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  type DocumentRecord,
  type DocumentsRepository,
} from './documents';
import { ApiError } from './errors';
import type { ExternalResult, ExternalSearch } from './external/tavily';
import type { IngestionEnqueuer } from './queue';
import type { QuotaService } from './quota';
import { answerQuestion, type AnswerDeps } from './rag/answer';
import { UPLOAD_URL_TTL_SECONDS, type FileStorage } from './storage/file-storage';

export interface AppDeps {
  authenticate: Authenticator;
  documents: DocumentsRepository;
  storage: FileStorage;
  enqueue: IngestionEnqueuer;
  quota: QuotaService;
  answer: Omit<AnswerDeps, 'quota'>;
  /** Sin configurar, las preguntas que piden contexto externo lo reciben como no disponible. */
  externalSearch?: ExternalSearch;
  corsOrigins?: readonly string[];
  logger?: boolean;
}

const createDocumentBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});
const documentParams = z.object({ id: z.uuid() });
const questionBody = z.object({
  question: z.string().trim().min(1).max(2000),
  documentIds: z.array(z.uuid()).min(1).max(100).optional(),
  includeExternal: z.boolean().default(false),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('REQ_INVALID', 400);
  return parsed.data;
}

/** Nunca expone `filePath` ni el error interno de la ingesta. */
function toPublicDocument(document: DocumentRecord) {
  return {
    id: document.id,
    title: document.title,
    sizeBytes: document.sizeBytes,
    status: document.status,
    totalPages: document.totalPages,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 64 * 1024 });
  await app.register(cors, { origin: [...(deps.corsOrigins ?? [])] });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({ error: { code: error.code } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL' } });
  });

  async function requireUser(request: FastifyRequest): Promise<string> {
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    const userId = scheme === 'Bearer' && token ? await deps.authenticate(token) : null;
    if (userId === null) throw new ApiError('AUTH_REQUIRED', 401);
    return userId;
  }

  async function requireDocument(userId: string, params: unknown): Promise<DocumentRecord> {
    const { id } = parse(documentParams, params);
    const document = await deps.documents.get(userId, id);
    if (!document) throw new ApiError('DOC_NOT_FOUND', 404);
    return document;
  }

  app.get('/health', () => ({ status: 'ok' }));

  // Registra el documento y entrega la URL prefirmada: el archivo va directo a R2.
  app.post('/v1/documents', async (request, reply) => {
    const userId = await requireUser(request);
    const body = parse(createDocumentBody, request.body);

    const extension = extensionOf(body.fileName);
    const contentType = UPLOAD_CONTENT_TYPES[extension];
    if (body.sizeBytes > MAX_UPLOAD_BYTES) throw new ApiError('UP_SIZE', 413);
    if (contentType === undefined) throw new ApiError('UP_FORMAT', 415);
    if (!(await deps.quota.consume(userId, 'storage_bytes', body.sizeBytes))) {
      throw new ApiError('UP_QUOTA', 409);
    }

    const id = randomUUID();
    const filePath = `${userId}/${id}.${extension}`;
    try {
      const uploadUrl = await deps.storage.createUploadUrl(filePath, contentType, body.sizeBytes);
      await deps.documents.create({
        id,
        userId,
        title: body.fileName,
        filePath,
        sizeBytes: body.sizeBytes,
      });
      return await reply.status(201).send({
        documentId: id,
        uploadUrl,
        uploadHeaders: { 'Content-Type': contentType },
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      });
    } catch (error) {
      await deps.quota.release(userId, 'storage_bytes', body.sizeBytes);
      throw error;
    }
  });

  // La ruta solo verifica y encola (202). Parseo y embeddings ocurren en el worker.
  app.post('/v1/documents/:id/complete', async (request, reply) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    if (document.status !== 'pending') throw new ApiError('DOC_STATE', 409);

    const actualSize = await deps.storage.sizeOf(document.filePath);
    if (actualSize === null) throw new ApiError('UP_NETWORK', 409);
    if (actualSize !== document.sizeBytes) {
      // Lo subido no es lo declarado: la cuota se cobró por otro tamaño.
      await deps.storage.delete(document.filePath);
      await deps.documents.markFailed(document.id, 'El tamaño subido no coincide con el declarado');
      await deps.quota.release(userId, 'storage_bytes', document.sizeBytes);
      throw new ApiError('UP_SIZE', 422);
    }

    await deps.enqueue(document.id);
    return reply.status(202).send({ documentId: document.id, status: document.status });
  });

  app.get('/v1/documents', async (request) => {
    const userId = await requireUser(request);
    const documents = await deps.documents.list(userId);
    return { documents: documents.map(toPublicDocument) };
  });

  app.get('/v1/documents/:id', async (request) => {
    const userId = await requireUser(request);
    return toPublicDocument(await requireDocument(userId, request.params));
  });

  app.delete('/v1/documents/:id', async (request, reply) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    // Primero el archivo: si R2 falla, la fila sigue ahí y se puede reintentar.
    await deps.storage.delete(document.filePath);
    await deps.documents.delete(userId, document.id);
    await deps.quota.release(userId, 'storage_bytes', document.sizeBytes);
    return reply.status(204).send();
  });

  app.post('/v1/questions', async (request) => {
    const userId = await requireUser(request);
    const body = parse(questionBody, request.body);

    let result;
    try {
      result = await answerQuestion(
        { ...deps.answer, quota: deps.quota },
        {
          userId,
          question: body.question,
          ...(body.documentIds === undefined ? {} : { documentIds: body.documentIds }),
        },
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      request.log.error(error);
      throw new ApiError('CHAT_FAILED', 502);
    }

    const answer =
      result.status === 'answered'
        ? { status: result.status, claims: result.claims }
        : { status: result.status, message: result.message };

    // Lo externo solo se consulta si se pide, y viaja aparte de la respuesta.
    if (!body.includeExternal) return answer;
    let external: { source: 'internet'; results: ExternalResult[] } | { unavailable: true } = {
      unavailable: true,
    };
    if (deps.externalSearch) {
      try {
        external = { source: 'internet', results: await deps.externalSearch(body.question) };
      } catch (error) {
        request.log.warn(error);
      }
    }
    return { ...answer, external };
  });

  return app;
}
