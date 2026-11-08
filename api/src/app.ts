import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { deleteUserAccount, type AuthUserDeleter } from './account';
import { buildAccountExport, confirmedEmail, type AccountExportRepository } from './account-export';
import {
  authHasMore,
  countAuthUsers,
  createAdminGate,
  DEFAULT_ADMIN_PER_PAGE,
  DOCUMENT_STATUSES,
  MAX_ADMIN_PER_PAGE,
  type AdminAuditRecord,
  type AdminDocumentRecord,
  type AdminRepository,
  type AuthUsersDirectory,
} from './admin';
import type { AuthSession, Authenticator } from './auth';
import {
  CONSENT_DOCUMENTS,
  MAX_CONSENT_VERSION,
  type ConsentRecord,
  type ConsentsRepository,
} from './consents';
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
import { loggerOptions, type LogStream } from './logging';
import { IngestionAlreadyQueuedError, type IngestionEnqueuer } from './queue';
import { FREE_LIMITS, periodFor, type QuotaService } from './quota';
import { answerQuestion, type AnswerDeps } from './rag/answer';
import { createManifestCache } from './page-manifest';
import { derivedPrefix, UPLOAD_URL_TTL_SECONDS, type FileStorage } from './storage/file-storage';
import { MAX_SEARCH_QUERY, MIN_SEARCH_QUERY, type SearchRepository } from './search';
import { withPageStructure } from './topic-content';
import { SummaryLimitError, type SummaryBlock, type TopicSummarizer } from './topic-summary';
import { isTransientAiError } from './llm/retry';
import {
  MAX_WAITLIST_EMAIL,
  WAITLIST_SOURCES,
  type WaitlistRecord,
  type WaitlistRepository,
} from './waitlist';

/** Peticiones permitidas por ventana de tiempo, por usuario (o por IP sin sesión). */
export interface RateLimitRule {
  max: number;
  timeWindowMs: number;
}

export interface RateLimitConfig {
  /** Toda la API. */
  global: RateLimitRule;
  /** Rutas caras: preguntas, contexto externo y registro de subidas. */
  strict: RateLimitRule;
  /** Lista de espera pública (por IP); sin indicar usa `DEFAULT_WAITLIST_LIMIT`. */
  waitlist?: RateLimitRule;
}

/** Ruta sin sesión que escribe en la base: pocas inscripciones por IP y hora. */
export const DEFAULT_WAITLIST_LIMIT: RateLimitRule = { max: 10, timeWindowMs: 60 * 60_000 };

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  global: { max: 300, timeWindowMs: 60_000 },
  strict: { max: 20, timeWindowMs: 60_000 },
};

export interface AppDeps {
  authenticate: Authenticator;
  documents: DocumentsRepository;
  consents: ConsentsRepository;
  /** Lista de espera de menores: solo la escribe y lee el backend. */
  waitlist: WaitlistRepository;
  /** Consultas propias de la exportación de datos (ARCO). */
  accountExport: AccountExportRepository;
  /** Búsqueda en títulos, temas y contenido de los documentos del usuario. */
  contentSearch: SearchRepository;
  storage: FileStorage;
  enqueue: IngestionEnqueuer;
  quota: QuotaService;
  answer: Omit<AnswerDeps, 'quota'>;
  deleteAuthUser: AuthUserDeleter;
  /** Panel de administrador: solo metadatos y conteos, nunca contenido. */
  admin: AdminRepository;
  /** Usuarios de Supabase Auth (Admin API con la service role key). */
  authUsers: AuthUsersDirectory;
  /** Correos con acceso a /v1/admin/* (`ADMIN_EMAILS`); sin indicar, nadie es administrador. */
  adminEmails?: readonly string[];
  /** Cuánto se recuerda que una cuenta es admin verificada (por defecto 5 min). */
  adminVerifyTtlMs?: number;
  /** Sin configurar, el contexto externo responde como no disponible. */
  externalSearch?: ExternalSearch;
  /** Resúmenes de tema con IA (sin configurar, la ruta responde como no disponible). */
  summaries?: TopicSummarizer;
  corsOrigins?: readonly string[];
  /** `true` escribe en stdout; con `{ stream }` escribe ahí (pruebas). */
  logger?: boolean | { stream: LogStream };
  /** Sin indicar usa `DEFAULT_RATE_LIMIT`; `false` lo desactiva (pruebas). */
  rateLimit?: RateLimitConfig | false;
  /**
   * Detrás de un proxy (Railway): número de proxies de confianza delante de la API. Con `1`
   * la IP es la que vio el proxy; con `true` se tomaría la primera de X-Forwarded-For, que el
   * cliente puede inventar para esquivar el límite por IP.
   */
  trustProxy?: number | false;
}

const idParams = z.object({ id: z.uuid() });
const topicParams = z.object({ topicId: z.uuid() });
const pageParams = z.object({ page: z.coerce.number().int().min(1).max(10_000) });
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
const searchQuery = z.object({
  q: z.string().trim().min(MIN_SEARCH_QUERY).max(MAX_SEARCH_QUERY),
});
const externalBody = z.object({ question: z.string().trim().min(1).max(2000) });
const pageQuery = {
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  perPage: z.coerce.number().int().min(1).max(MAX_ADMIN_PER_PAGE).default(DEFAULT_ADMIN_PER_PAGE),
};
const adminPageQuery = z.object(pageQuery);
const adminDocumentsQuery = z.object({
  ...pageQuery,
  status: z.enum(DOCUMENT_STATUSES).optional(),
});
const consentBody = z.object({
  document: z.enum(CONSENT_DOCUMENTS),
  // Versión con formato de fecha ISO (`LEGAL_VERSION` de la app): evita filas basura.
  version: z
    .string()
    .trim()
    .max(MAX_CONSENT_VERSION)
    .regex(/^\d{4}-\d{2}-\d{2}$/u),
});
const waitlistBody = z.object({
  email: z.string().trim().max(MAX_WAITLIST_EMAIL).toLowerCase().pipe(z.email()),
  // Sin consentimiento expreso no se guarda nada.
  consent: z.literal(true),
  source: z.enum(WAITLIST_SOURCES).default('app'),
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

function toPublicConsent(consent: ConsentRecord) {
  return {
    document: consent.document,
    version: consent.version,
    acceptedAt: consent.acceptedAt.toISOString(),
  };
}

/** Metadatos del documento para el panel: sin ruta del archivo ni contenido. */
function toAdminDocument(document: AdminDocumentRecord) {
  return {
    id: document.id,
    userId: document.userId,
    title: document.title,
    sizeBytes: document.sizeBytes,
    status: document.status,
    totalPages: document.totalPages,
    topicCount: document.topicCount,
    errorMessage: document.errorMessage,
    createdAt: document.createdAt.toISOString(),
  };
}

function toAdminAudit(entry: AdminAuditRecord) {
  return {
    id: entry.id,
    adminEmail: entry.adminEmail,
    action: entry.action,
    target: entry.target,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toAdminWaitlist(entry: WaitlistRecord) {
  return {
    id: entry.id,
    email: entry.email,
    consent: entry.consent,
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
  };
}

/** Pide un elemento de más para saber si hay otra página sin contar toda la tabla. */
function paginate<T>(rows: T[], perPage: number): { items: T[]; hasMore: boolean } {
  return { items: rows.slice(0, perPage), hasMore: rows.length > perPage };
}

function bearerToken(request: FastifyRequest): string | null {
  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const pageManifests = createManifestCache(deps.storage);
  const logger =
    deps.logger === undefined || deps.logger === false
      ? false
      : loggerOptions(deps.logger === true ? undefined : deps.logger.stream);
  // Igual que `trustProxy: n` de proxy-addr (los tipos de Fastify no aceptan el número).
  const hops = deps.trustProxy ?? false;
  const app = Fastify({
    logger,
    bodyLimit: 64 * 1024,
    trustProxy: hops === false ? false : (_address: string, hop: number) => hop < hops,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({ error: { code: error.code } });
    }
    // Errores de Fastify con estado 4xx (JSON mal formado, cuerpo muy grande…): son de la
    // petición, no del servidor. No se registran: el mensaje de JSON.parse cita el cuerpo.
    const status =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    if (status >= 400 && status < 500) {
      return reply.status(status).send({ error: { code: 'REQ_INVALID' } });
    }
    request.log.error(error);
    return reply.status(500).send({ error: { code: 'INTERNAL' } });
  });

  // API JSON: sin HTML que proteger, pero las cabeceras cierran nosniff, framing y referrer.
  // CORP en cross-origin porque la app web vive en otro origen (lo controla CORS).
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  });
  await app.register(cors, {
    origin: [...(deps.corsOrigins ?? [])],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // Un token se verifica una sola vez por petición: lo usan el límite y las rutas.
  const sessions = new WeakMap<FastifyRequest, Promise<AuthSession | null>>();
  function sessionUser(request: FastifyRequest): Promise<AuthSession | null> {
    let session = sessions.get(request);
    if (!session) {
      const token = bearerToken(request);
      session = token === null ? Promise.resolve(null) : deps.authenticate(token);
      sessions.set(request, session);
    }
    return session;
  }

  async function requireUser(request: FastifyRequest): Promise<string> {
    const session = await sessionUser(request);
    if (session === null) throw new ApiError('AUTH_REQUIRED', 401);
    return session.userId;
  }

  const adminGate = createAdminGate({
    adminEmails: deps.adminEmails ?? [],
    directory: deps.authUsers,
    ...(deps.adminVerifyTtlMs === undefined ? {} : { ttlMs: deps.adminVerifyTtlMs }),
  });

  /**
   * Sin sesión, 401. Con sesión, 403 salvo que el email del JWT esté en ADMIN_EMAILS y la
   * Admin API confirme esa misma cuenta con el correo confirmado (`createAdminGate`).
   */
  async function requireAdmin(request: FastifyRequest): Promise<AuthSession & { email: string }> {
    const session = await sessionUser(request);
    if (session === null) throw new ApiError('AUTH_REQUIRED', 401);
    const email = await adminGate.check(session);
    if (email === null) throw new ApiError('FORBIDDEN', 403);
    return { ...session, email };
  }

  const limits = deps.rateLimit ?? DEFAULT_RATE_LIMIT;
  if (limits !== false) {
    await app.register(rateLimit, {
      global: true,
      max: limits.global.max,
      timeWindow: limits.global.timeWindowMs,
      // Por usuario con sesión válida; sin ella, por IP. Un token inválido no da cupo propio.
      keyGenerator: async (request) => {
        const session = await sessionUser(request).catch(() => null);
        return session === null ? `ip:${request.ip}` : `user:${session.userId}`;
      },
      errorResponseBuilder: () => new ApiError('RATE_LIMITED', 429),
    });
  }
  /** Límite más estricto para las rutas caras: en ellas reemplaza al global. */
  const strictLimit =
    limits === false
      ? {}
      : {
          config: { rateLimit: { max: limits.strict.max, timeWindow: limits.strict.timeWindowMs } },
        };
  /** Solo por IP: esta ruta es pública y no debe depender de ningún token. */
  const waitlistRule = limits === false ? null : (limits.waitlist ?? DEFAULT_WAITLIST_LIMIT);
  const waitlistLimit =
    waitlistRule === null
      ? {}
      : {
          config: {
            rateLimit: {
              max: waitlistRule.max,
              timeWindow: waitlistRule.timeWindowMs,
              keyGenerator: (request: FastifyRequest) => `ip:${request.ip}`,
            },
          },
        };

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

  app.get('/health', { config: { rateLimit: false } }, () => ({ status: 'ok' }));

  // --- Cuenta y consumo ------------------------------------------------------------

  app.get('/v1/me/usage', async (request) => {
    const userId = await requireUser(request);
    const used = await deps.quota.usage(userId);
    return {
      questionsToday: used.questions,
      questionsLimit: FREE_LIMITS.questions,
      storageBytes: used.storage_bytes,
      storageLimit: FREE_LIMITS.storage_bytes,
      summariesToday: used.summaries,
      summariesLimit: FREE_LIMITS.summaries,
    };
  });

  /** Si esa cuenta dejó su correo confirmado en la lista de espera, también se borra. */
  async function forgetWaitlistEntry(userId: string): Promise<void> {
    const email = await confirmedEmail(deps.authUsers, userId);
    if (email !== null) await deps.waitlist.removeByEmail(email);
  }

  // Derecho de acceso (ARCO): todo lo del usuario en un JSON que se descarga. Es una consulta
  // cara (todo el texto de sus documentos): usa el límite estricto.
  app.get('/v1/account/export', strictLimit, async (request, reply) => {
    const session = await sessionUser(request);
    if (session === null) throw new ApiError('AUTH_REQUIRED', 401);
    const data = await buildAccountExport(deps, session);
    return reply
      .header('Content-Disposition', 'attachment; filename="apuntor-mis-datos.json"')
      .header('Cache-Control', 'no-store')
      .send(data);
  });

  // Borra archivos, datos y el usuario de Supabase Auth, en ese orden: si algo falla, se
  // puede reintentar porque la sesión sigue siendo válida.
  app.delete('/v1/account', async (request, reply) => {
    const userId = await requireUser(request);
    await forgetWaitlistEntry(userId);
    await deleteUserAccount(deps, userId);
    return reply.status(204).send();
  });

  // --- Consentimientos (términos y privacidad) ---------------------------------

  // Idempotente: aceptar otra vez la misma versión devuelve la aceptación original.
  app.post('/v1/consents', async (request, reply) => {
    const userId = await requireUser(request);
    const { document, version } = parse(consentBody, request.body);
    const consent = await deps.consents.accept(userId, document, version);
    return reply.status(201).send(toPublicConsent(consent));
  });

  app.get('/v1/consents', async (request) => {
    const userId = await requireUser(request);
    return { consents: (await deps.consents.list(userId)).map(toPublicConsent) };
  });

  // --- Lista de espera de menores (44) --------------------------------------------

  // Pública, sin sesión. Responde igual si el correo ya estaba: no revela quién está inscrito.
  app.post('/v1/waitlist', waitlistLimit, async (request, reply) => {
    const { email, consent, source } = parse(waitlistBody, request.body);
    await deps.waitlist.join({ email, consent, source });
    return reply.status(201).send({ status: 'joined' });
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
  app.post('/v1/documents', strictLimit, async (request, reply) => {
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

  // Contenido del documento bajo un tema, para leerlo antes de preguntar. Es del propio
  // usuario: el panel de administrador nunca lo expone.
  app.get('/v1/documents/:id/topics/:topicId', async (request) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    const { topicId } = parse(topicParams, request.params);
    const content = await deps.documents.topicContent(userId, document.id, topicId);
    // Un tema de otro documento (o ajeno) responde igual que un documento inexistente.
    if (!content) throw new ApiError('DOC_NOT_FOUND', 404);
    const manifest = await pageManifests.get(document.id, document.filePath);
    const pages = new Map((manifest?.pages ?? []).map((p) => [p.pageNumber, p]));
    const blocks = withPageStructure(
      content.blocks,
      new Map([...pages].map(([n, p]) => [n, p.text])),
    );
    const pageNumbers = [...new Set(blocks.map((b) => b.pageNumber))];
    const pageImages = await Promise.all(
      pageNumbers.flatMap((pageNumber) => {
        const image = pages.get(pageNumber)?.image;
        return image
          ? [
              deps.storage.createDownloadUrl(image.key).then((url) => ({
                pageNumber,
                url,
                width: image.width,
                height: image.height,
              })),
            ]
          : [];
      }),
    );
    return {
      topic: content.topic,
      path: content.path,
      blocks: blocks.map(({ pageNumber, sectionPath, text }) => ({
        pageNumber,
        sectionPath,
        text,
      })),
      pageImages,
      truncated: content.truncated,
      document: { id: document.id, title: document.title },
    };
  });

  // Una página del original (PDF dibujado), para comprobar una cita. Enlace temporal.
  app.get('/v1/documents/:id/pages/:page', async (request) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    const { page } = parse(pageParams, request.params);
    const manifest = await pageManifests.get(document.id, document.filePath);
    const image = manifest?.pages.find((p) => p.pageNumber === page)?.image;
    if (!image) throw new ApiError('DOC_NOT_FOUND', 404);
    return {
      pageNumber: page,
      url: await deps.storage.createDownloadUrl(image.key),
      width: image.width,
      height: image.height,
    };
  });

  // Resumen del tema con su estructura (tablas, fórmulas, figuras recortadas). Se genera una
  // vez con la IA y se guarda; las figuras se ven con enlaces temporales.
  app.get('/v1/documents/:id/topics/:topicId/summary', strictLimit, async (request) => {
    const userId = await requireUser(request);
    const document = await requireDocument(userId, request.params);
    const { topicId } = parse(topicParams, request.params);
    const content = await deps.documents.topicContent(userId, document.id, topicId);
    if (!content) throw new ApiError('DOC_NOT_FOUND', 404);
    if (!deps.summaries) throw new ApiError('CHAT_FAILED', 503);
    const manifest = await pageManifests.get(document.id, document.filePath);
    const blocks = withPageStructure(
      content.blocks,
      new Map((manifest?.pages ?? []).map((p) => [p.pageNumber, p.text])),
    );
    let summary;
    try {
      // Solo se cobra si hay que generarlo: abrir un resumen ya guardado es gratis.
      summary = await deps.summaries.get(
        {
          filePath: document.filePath,
          topic: content.topic,
          path: content.path,
          blocks,
          manifest,
        },
        {
          reserve: () => deps.quota.consume(userId, 'summaries', 1),
          release: () => deps.quota.release(userId, 'summaries', 1),
        },
      );
    } catch (error) {
      if (error instanceof SummaryLimitError) throw new ApiError('SUMMARY_DAILY_LIMIT', 429);
      if (isTransientAiError(error)) throw new ApiError('RATE_LIMITED', 429);
      request.log.error({ err: error instanceof Error ? error.message : 'error' }, 'resumen');
      throw new ApiError('CHAT_FAILED', 502);
    }
    const out = await Promise.all(
      summary.blocks.map(async (block: SummaryBlock) => {
        if (block.type !== 'figure') return block;
        const { key, ...rest } = block;
        return { ...rest, url: await deps.storage.createDownloadUrl(key) };
      }),
    );
    // Páginas citadas por el resumen, para comprobarlo contra el original.
    const cited = new Set<number>();
    for (const block of summary.blocks) {
      if (block.type === 'figure') cited.add(block.page);
      else if ('pages' in block) block.pages.forEach((p) => cited.add(p));
    }
    const images = new Map((manifest?.pages ?? []).map((p) => [p.pageNumber, p.image]));
    const pageImages = await Promise.all(
      [...cited]
        .sort((a, b) => a - b)
        .flatMap((pageNumber) => {
          const image = images.get(pageNumber);
          return image
            ? [
                deps.storage
                  .createDownloadUrl(image.key)
                  .then((url) => ({ pageNumber, url, width: image.width, height: image.height })),
              ]
            : [];
        }),
    );
    return {
      topic: content.topic,
      path: content.path,
      blocks: out,
      pageImages,
      document: { id: document.id, title: document.title },
    };
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
    await deps.storage.deletePrefix(derivedPrefix(document.filePath));
    pageManifests.forget(document.id);
    await deps.documents.delete(userId, document.id);
    await deps.quota.release(userId, 'storage_bytes', document.sizeBytes);
    return reply.status(204).send();
  });

  // --- Búsqueda en los apuntes -----------------------------------------------------

  app.get('/v1/search', async (request) => {
    const userId = await requireUser(request);
    const { q } = parse(searchQuery, request.query);
    return deps.contentSearch.search(userId, q);
  });

  // --- Preguntas -------------------------------------------------------------------

  app.post('/v1/questions', strictLimit, async (request, reply) => {
    const userId = await requireUser(request);
    const body = parse(questionBody, request.body);
    // Si el estudiante detiene la pregunta (cierra la conexión), se corta la IA y la pregunta
    // no se descuenta del límite diario.
    const stop = new AbortController();
    const onClose = (): void => {
      if (!reply.sent) stop.abort();
    };
    request.raw.on('close', onClose);
    try {
      const result = await answerQuestion(
        { ...deps.answer, quota: deps.quota },
        {
          userId,
          question: body.question,
          signal: stop.signal,
          ...(body.documentIds === undefined ? {} : { documentIds: body.documentIds }),
        },
      );
      if (result.status === 'answered') return { status: result.status, claims: result.claims };
      if (result.status === 'small_talk') return { status: result.status, kind: result.kind };
      // El motivo deja a la app explicar por qué no hubo respuesta.
      return { status: result.status, message: result.message, reason: result.reason };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (stop.signal.aborted) throw new ApiError('CHAT_CANCELLED', 499);
      if (isTransientAiError(error)) throw new ApiError('RATE_LIMITED', 429);
      request.log.error(error);
      throw new ApiError('CHAT_FAILED', 502);
    } finally {
      request.raw.off('close', onClose);
    }
  });

  // Contexto externo: aparte de la respuesta, nunca entra al prompt. Cuenta como pregunta.
  app.post('/v1/external', strictLimit, async (request) => {
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

  // --- Panel de administrador ----------------------------------------------------
  // Solo metadatos, conteos y estados: nunca fragmentos, preguntas, respuestas ni archivos.
  // Toda acción que cambia algo queda en `admin_audit`. Usa el límite global de peticiones.

  app.get('/v1/admin/me', async (request) => {
    const admin = await requireAdmin(request);
    return { admin: true, email: admin.email };
  });

  app.get('/v1/admin/stats', async (request) => {
    await requireAdmin(request);
    const [stats, users] = await Promise.all([
      deps.admin.stats(periodFor('questions')),
      countAuthUsers(deps.authUsers),
    ]);
    return { users, ...stats };
  });

  app.get('/v1/admin/users', async (request) => {
    await requireAdmin(request);
    const { page, perPage } = parse(adminPageQuery, request.query);
    const result = await deps.authUsers.list(page, perPage);
    const summaries = await deps.admin.userSummaries(
      result.users.map((user) => user.id),
      periodFor('questions'),
    );
    return {
      users: result.users.map((user) => {
        const summary = summaries.get(user.id);
        return {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt.toISOString(),
          lastSignInAt: user.lastSignInAt?.toISOString() ?? null,
          provider: user.provider,
          documents: summary?.documents ?? 0,
          storageBytes: summary?.storageBytes ?? 0,
          questionsToday: summary?.questionsToday ?? 0,
          consentVersion: summary?.consentVersion ?? null,
        };
      }),
      page,
      hasMore: authHasMore(result, page, perPage),
    };
  });

  app.get('/v1/admin/documents', async (request) => {
    await requireAdmin(request);
    const { page, perPage, status } = parse(adminDocumentsQuery, request.query);
    const rows = await deps.admin.listDocuments({
      ...(status === undefined ? {} : { status }),
      limit: perPage + 1,
      offset: (page - 1) * perPage,
    });
    const { items, hasMore } = paginate(rows, perPage);
    return { documents: items.map(toAdminDocument), page, hasMore };
  });

  // Reintenta la ingesta de un documento fallido: vuelve a `pending` y se encola (202).
  app.post('/v1/admin/documents/:id/retry', async (request, reply) => {
    const admin = await requireAdmin(request);
    const { id } = parse(idParams, request.params);
    const result = await deps.admin.retryFailedDocument(id);
    if (result === 'not_found') throw new ApiError('DOC_NOT_FOUND', 404);
    if (result === 'not_failed') throw new ApiError('DOC_STATE', 409);
    try {
      await deps.enqueue(id);
    } catch (error) {
      // Sin encolar quedaría en `pending` para siempre: vuelve a fallido para reintentarlo.
      await deps.documents.markFailed(id, 'No se pudo encolar el reintento');
      throw error;
    }
    await deps.admin.recordAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'document.retry',
      target: `document:${id}`,
    });
    return reply.status(202).send({ id, status: 'pending' });
  });

  // Reprocesa un documento ya completado (fragmentos, temas, páginas y resúmenes): 202.
  app.post('/v1/admin/documents/:id/reprocess', async (request, reply) => {
    const admin = await requireAdmin(request);
    const { id } = parse(idParams, request.params);
    const result = await deps.admin.reprocessCompletedDocument(id);
    if (result === 'not_found') throw new ApiError('DOC_NOT_FOUND', 404);
    if (result === 'not_completed') throw new ApiError('DOC_STATE', 409);
    try {
      await deps.enqueue(id, { requireNew: true });
    } catch (error) {
      // Sus fragmentos siguen intactos: vuelve a `completed` en lugar de quedar en `pending`.
      await deps.admin.restoreCompletedDocument(id);
      if (error instanceof IngestionAlreadyQueuedError) throw new ApiError('DOC_STATE', 409);
      throw error;
    }
    await deps.admin.recordAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'document.reprocess',
      target: `document:${id}`,
    });
    return reply.status(202).send({ id, status: 'pending' });
  });

  // Misma lógica que DELETE /v1/account. Un administrador no se borra a sí mismo por aquí.
  app.delete('/v1/admin/users/:id', async (request, reply) => {
    const admin = await requireAdmin(request);
    const { id } = parse(idParams, request.params);
    if (id === admin.userId) throw new ApiError('ADMIN_TARGET_IS_SELF', 409);
    await forgetWaitlistEntry(id);
    await deleteUserAccount(deps, id);
    adminGate.forget(id);
    await deps.admin.recordAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'user.delete',
      target: `user:${id}`,
    });
    return reply.status(204).send();
  });

  // El correo de la lista es un metadato: el panel lo muestra y lo borra si lo piden.
  app.get('/v1/admin/waitlist', async (request) => {
    await requireAdmin(request);
    const { page, perPage } = parse(adminPageQuery, request.query);
    const rows = await deps.waitlist.list({ limit: perPage + 1, offset: (page - 1) * perPage });
    const { items, hasMore } = paginate(rows, perPage);
    return { entries: items.map(toAdminWaitlist), page, hasMore };
  });

  // La auditoría guarda solo el id: borrar el correo lo borra de verdad.
  app.delete('/v1/admin/waitlist/:id', async (request, reply) => {
    const admin = await requireAdmin(request);
    const { id } = parse(idParams, request.params);
    if (!(await deps.waitlist.remove(id))) throw new ApiError('WAITLIST_NOT_FOUND', 404);
    await deps.admin.recordAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'waitlist.delete',
      target: `waitlist:${id}`,
    });
    return reply.status(204).send();
  });

  app.get('/v1/admin/audit', async (request) => {
    await requireAdmin(request);
    const { page, perPage } = parse(adminPageQuery, request.query);
    const rows = await deps.admin.listAudit({ limit: perPage + 1, offset: (page - 1) * perPage });
    const { items, hasMore } = paginate(rows, perPage);
    return { entries: items.map(toAdminAudit), page, hasMore };
  });

  return app;
}
