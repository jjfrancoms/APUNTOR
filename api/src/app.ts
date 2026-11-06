import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUserDeleter } from './account';
import type { Authenticator } from './auth';
import {
  extensionOf,
  MAX_COURSE_TITLE,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONTENT_TYPES,
  type CourseRecord,
  type DocumentRecord,
  type DocumentsRepository,
} from './documents';
import { ApiError } from './errors';
import type { ExternalSearch } from './external/tavily';
import type { IngestionEnqueuer } from './queue';
import { FREE_LIMITS, type QuotaService } from './quota';
import { answerQuestion, type AnswerDeps } from './rag/answer';
import { UPLOAD_URL_TTL_SECONDS, type FileStorage } from './storage/file-storage';

export interface AppDeps {
  authenticate: Authenticator;
  documents: DocumentsRepository;
  storage: FileStorage;
  enqueue: IngestionEnqueuer;
  quota: QuotaService;
  answer: Omit<AnswerDeps, 'quota'>;
  deleteAuthUser: AuthUserDeleter;
  /** Sin configurar, el contexto externo responde como no disponible. */
  externalSearch?: ExternalSearch;
  corsOrigins?: readonly string[];
  logger?: boolean;
}

const idParams = z.object({ id: z.uuid() });
const courseTitle = z.string().trim().min(1).max(MAX_COURSE_TITLE);
const createDocumentBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  courseId: z.uuid().optional(),
});
const updateDocumentBody = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    courseId: z.uuid().nullable().optional(),
  })
  .refine((body) => body.title !== undefined || body.courseId !== undefined);
const courseBody = z.object({ title: courseTitle });
const questionBody = z.object({
  question: z.string().trim().min(1).max(2000),
  documentIds: z.array(z.uuid()).min(1).max(100).optional(),
});
const externalBody = z.object({ question: z.string().trim().min(1).max(2000) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError('REQ_INVALID', 400);
  return parsed.data;
}

/** Nunca expone `filePath` ni el error interno de la ingesta. */
function toPublicDocument(document: DocumentRecord) {
  return {
    id: document.id,
    courseId: document.courseId,
    title: document.title,
    sizeBytes: document.sizeBytes,
    status: document.status,
    totalPages: document.totalPages,
    topicCount: document.topicCount,
    createdAt: document.createdAt.toISOString(),
  };
}

function toPublicCourse(course: CourseRecord) {
  return { id: course.id, title: course.title, createdAt: course.createdAt.toISOString() };
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 64 * 1024 });
  await app.register(cors, {
    origin: [...(deps.corsOrigins ?? [])],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

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
    const { id } = parse(idParams, params);
    const document = await deps.documents.get(userId, id);
    if (!document) throw new ApiError('DOC_NOT_FOUND', 404);
    return document;
  }

  async function requireCourse(userId: string, courseId: string): Promise<CourseRecord> {
    const course = await deps.documents.getCourse(userId, courseId);
    if (!course) throw new ApiError('COURSE_NOT_FOUND', 404);
    return course;
  }

  app.get('/health', () => ({ status: 'ok' }));

  // --- Cuenta y consumo ------------------------------------------------------------

  app.get('/v1/me/usage', async (request) => {
    const userId = await requireUser(request);
    const used = await deps.quota.usage(userId);
    return {
      questionsToday: used.questions,
      questionsLimit: FREE_LIMITS.questions,
      storageBytes: used.storage_bytes,
      storageLimit: FREE_LIMITS.storage_bytes,
    };
  });

  // Borra archivos, datos y el usuario de Supabase Auth, en ese orden: si algo falla, se
  // puede reintentar porque la sesión sigue siendo válida.
  app.delete('/v1/account', async (request, reply) => {
    const userId = await requireUser(request);
    for (const document of await deps.documents.list(userId)) {
      await deps.storage.delete(document.filePath);
    }
    await deps.documents.deleteAllForUser(userId);
    await deps.deleteAuthUser(userId);
    return reply.status(204).send();
  });

  // --- Cursos ----------------------------------------------------------------------

  app.get('/v1/courses', async (request) => {
    const userId = await requireUser(request);
    return { courses: (await deps.documents.listCourses(userId)).map(toPublicCourse) };
  });

  app.post('/v1/courses', async (request, reply) => {
    const userId = await requireUser(request);
    const { title } = parse(courseBody, request.body);
    const course = await deps.documents.createCourse(userId, title);
    return reply.status(201).send(toPublicCourse(course));
  });

  app.patch('/v1/courses/:id', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const { title } = parse(courseBody, request.body);
    await requireCourse(userId, id);
    await deps.documents.renameCourse(userId, id, title);
    return { id, title };
  });

  app.delete('/v1/courses/:id', async (request, reply) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    await requireCourse(userId, id);
    // Los documentos quedan sin curso (ON DELETE SET NULL): borrar un curso no borra apuntes.
    await deps.documents.deleteCourse(userId, id);
    return reply.status(204).send();
  });

  // --- Documentos ------------------------------------------------------------------

  // Registra el documento y entrega la URL prefirmada: el archivo va directo a R2.
  app.post('/v1/documents', async (request, reply) => {
    const userId = await requireUser(request);
    const body = parse(createDocumentBody, request.body);

    const extension = extensionOf(body.fileName);
    const contentType = UPLOAD_CONTENT_TYPES[extension];
    if (body.sizeBytes > MAX_UPLOAD_BYTES) throw new ApiError('UP_SIZE', 413);
    if (contentType === undefined) throw new ApiError('UP_FORMAT', 415);
    if (body.courseId !== undefined) await requireCourse(userId, body.courseId);
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
        courseId: body.courseId ?? null,
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

  app.get('/v1/documents/:id/topics', async (request) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    return { topics: await deps.documents.topics(userId, document.id) };
  });

  app.patch('/v1/documents/:id', async (request) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    const body = parse(updateDocumentBody, request.body);
    if (typeof body.courseId === 'string') await requireCourse(userId, body.courseId);
    await deps.documents.update(userId, document.id, {
      ...(body.title === undefined ? {} : { title: body.title }),
      ...(body.courseId === undefined ? {} : { courseId: body.courseId }),
    });
    return toPublicDocument({
      ...document,
      ...(body.title === undefined ? {} : { title: body.title }),
      ...(body.courseId === undefined ? {} : { courseId: body.courseId }),
    });
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

  // --- Preguntas -------------------------------------------------------------------

  app.post('/v1/questions', async (request) => {
    const userId = await requireUser(request);
    const body = parse(questionBody, request.body);
    try {
      const result = await answerQuestion(
        { ...deps.answer, quota: deps.quota },
        {
          userId,
          question: body.question,
          ...(body.documentIds === undefined ? {} : { documentIds: body.documentIds }),
        },
      );
      return result.status === 'answered'
        ? { status: result.status, claims: result.claims }
        : { status: result.status, message: result.message };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      request.log.error(error);
      throw new ApiError('CHAT_FAILED', 502);
    }
  });

  // Contexto externo: aparte de la respuesta, nunca entra al prompt. Cuenta como pregunta.
  app.post('/v1/external', async (request) => {
    const userId = await requireUser(request);
    const { question } = parse(externalBody, request.body);
    if (!deps.externalSearch) throw new ApiError('EXTERNAL_UNAVAILABLE', 503);
    if (!(await deps.quota.consume(userId, 'questions', 1))) {
      throw new ApiError('CHAT_DAILY_LIMIT', 429);
    }
    try {
      return { source: 'internet', results: await deps.externalSearch(question) };
    } catch (error) {
      await deps.quota.release(userId, 'questions', 1);
      request.log.warn(error);
      throw new ApiError('EXTERNAL_UNAVAILABLE', 503);
    }
  });

  return app;
}
