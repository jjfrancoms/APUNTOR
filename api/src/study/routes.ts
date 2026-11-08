import type { FastifyInstance, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { z } from 'zod';
import { STUDY_SET_KINDS } from '../../../db/schema';
import type { DocumentRecord, DocumentsRepository } from '../documents';
import { ApiError } from '../errors';
import { isTransientAiError } from '../llm/retry';
import type { JsonGenerator } from '../llm/vertex';
import { periodFor, type QuotaService } from '../quota';
import { chunksForScope, generateStudyItems, spreadWithinBudget } from './generate';
import type { StudyItemRecord, StudyRepository, StudySetRecord } from './repository';

export interface StudyDeps {
  repository: StudyRepository;
  /** Modelo fuerte: se genera una vez y se guarda. */
  generator: JsonGenerator;
}

export interface StudyRouteContext {
  study: StudyDeps | undefined;
  quota: QuotaService;
  documents: Pick<DocumentsRepository, 'topics'>;
  requireUser: (request: FastifyRequest) => Promise<string>;
  requireDocument: (userId: string, params: unknown) => Promise<DocumentRecord>;
  strictLimit: RouteShorthandOptions;
  parse: <T>(schema: z.ZodType<T>, value: unknown) => T;
}

const MIN_STUDY_COUNT = 3;
const MAX_STUDY_COUNT = 20;
/** Evita valores absurdos; el tope real es el número de elementos del conjunto. */
const MAX_RESULT_TOTAL = 200;

const idParams = z.object({ id: z.uuid() });
const createSetBody = z.object({
  documentId: z.uuid(),
  topicId: z.uuid().optional(),
  kind: z.enum(STUDY_SET_KINDS),
  count: z.number().int().min(MIN_STUDY_COUNT).max(MAX_STUDY_COUNT).default(10),
});
const listQuery = z.object({
  documentId: z.uuid().optional(),
  kind: z.enum(STUDY_SET_KINDS).optional(),
});
const resultBody = z
  .object({
    score: z.number().int().min(0).max(MAX_RESULT_TOTAL),
    total: z.number().int().min(1).max(MAX_RESULT_TOTAL),
  })
  .refine((body) => body.score <= body.total);
const reviewBody = z.object({ known: z.boolean() });

function toPublicSet(set: StudySetRecord) {
  return {
    id: set.id,
    documentId: set.documentId,
    documentTitle: set.documentTitle,
    topicId: set.topicId,
    topicTitle: set.topicTitle,
    kind: set.kind,
    itemCount: set.itemCount,
    lastScore: set.lastScore,
    lastTotal: set.lastTotal,
    createdAt: set.createdAt.toISOString(),
  };
}

/** La página sale del fragmento citado, nunca del modelo. */
function toPublicItem(item: StudyItemRecord) {
  const { quote, ...payload } = item.payload;
  return {
    id: item.id,
    ...payload,
    citation: {
      chunkId: item.chunkId,
      documentId: item.documentId,
      pageNumber: item.page,
      quote,
    },
  };
}

/** Rutas de quizzes, tarjetas y repaso. Todo es del propio usuario; el panel no las expone. */
export function registerStudyRoutes(app: FastifyInstance, ctx: StudyRouteContext): void {
  const { parse, quota, requireDocument, requireUser, strictLimit } = ctx;

  function requireStudy(): StudyDeps {
    if (!ctx.study) throw new ApiError('STUDY_FAILED', 503);
    return ctx.study;
  }

  const today = (): string => periodFor('study_generations');

  // Generar: lo caro va con el límite estricto y la cuota diaria.
  app.post('/v1/study/sets', strictLimit, async (request, reply) => {
    const userId = await requireUser(request);
    const body = parse(createSetBody, request.body);
    const { repository, generator } = requireStudy();
    const document = await requireDocument(userId, { id: body.documentId });
    if (document.status !== 'completed') throw new ApiError('DOC_STATE', 409);

    const topicId = body.topicId ?? null;
    const topics = topicId === null ? [] : await ctx.documents.topics(userId, document.id);
    // Un tema de otro documento (o ajeno) responde igual que un documento inexistente.
    if (topicId !== null && !topics.some((topic) => topic.id === topicId)) {
      throw new ApiError('DOC_NOT_FOUND', 404);
    }
    const chunks = spreadWithinBudget(
      chunksForScope(await repository.sourceChunks(userId, document.id), topics, topicId),
    );

    // Si el estudiante sale de la pantalla, se corta la IA y la generación no se cobra.
    const stop = new AbortController();
    const onClose = (): void => {
      if (!reply.sent) stop.abort();
    };
    request.raw.on('close', onClose);
    try {
      const created = await generateStudyItems(
        { generator, quota },
        { userId, kind: body.kind, count: body.count, chunks, signal: stop.signal },
        (items) =>
          repository.createSet({
            userId,
            documentId: document.id,
            topicId,
            kind: body.kind,
            items,
            today: today(),
          }),
      );
      return await reply
        .status(201)
        .send({ set: toPublicSet(created.set), items: created.items.map(toPublicItem) });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (stop.signal.aborted) throw new ApiError('CHAT_CANCELLED', 499);
      if (isTransientAiError(error)) throw new ApiError('RATE_LIMITED', 429);
      // Solo el mensaje: el objeto del error podría arrastrar el texto de los apuntes.
      request.log.error({ err: error instanceof Error ? error.message : 'error' }, 'estudio');
      throw new ApiError('STUDY_FAILED', 502);
    } finally {
      request.raw.off('close', onClose);
    }
  });

  app.get('/v1/study/sets', async (request) => {
    const userId = await requireUser(request);
    const query = parse(listQuery, request.query);
    const sets = await requireStudy().repository.listSets(userId, {
      ...(query.documentId === undefined ? {} : { documentId: query.documentId }),
      ...(query.kind === undefined ? {} : { kind: query.kind }),
    });
    return { sets: sets.map(toPublicSet) };
  });

  app.get('/v1/study/sets/:id', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const found = await requireStudy().repository.getSet(userId, id);
    if (!found) throw new ApiError('STUDY_NOT_FOUND', 404);
    return { set: toPublicSet(found.set), items: found.items.map(toPublicItem) };
  });

  app.delete('/v1/study/sets/:id', async (request, reply) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    if (!(await requireStudy().repository.deleteSet(userId, id))) {
      throw new ApiError('STUDY_NOT_FOUND', 404);
    }
    return reply.status(204).send();
  });

  app.post('/v1/study/sets/:id/results', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const { score, total } = parse(resultBody, request.body);
    const { repository } = requireStudy();
    const found = await repository.getSet(userId, id);
    if (!found) throw new ApiError('STUDY_NOT_FOUND', 404);
    if (found.set.kind !== 'quiz' || total > found.items.length) {
      throw new ApiError('REQ_INVALID', 400);
    }
    await repository.recordResult(userId, id, score, total);
    return { id, score, total };
  });

  app.post('/v1/study/items/:id/review', async (request) => {
    const userId = await requireUser(request);
    const { id } = parse(idParams, request.params);
    const { known } = parse(reviewBody, request.body);
    const result = await requireStudy().repository.review(userId, id, known, today());
    if (!result) throw new ApiError('STUDY_NOT_FOUND', 404);
    return { id, box: result.box, dueDate: result.dueDate };
  });

  app.get('/v1/study/review/today', async (request) => {
    const userId = await requireUser(request);
    const due = await requireStudy().repository.dueToday(userId, today());
    return {
      items: due.map((item) => ({
        ...toPublicItem(item),
        setId: item.setId,
        documentTitle: item.documentTitle,
        courseId: item.courseId,
        courseTitle: item.courseTitle,
        box: item.box,
        dueDate: item.dueDate,
      })),
    };
  });
}
