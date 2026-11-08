import { es, type ErrorCode } from '@/i18n/es';
import { config } from './config';
import { supabase } from './supabase';

/** Error de la API con su código estable (`UP_SIZE`, `CHAT_DAILY_LIMIT`…). */
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'ApiRequestError';
  }
}

/** Código que la interfaz sabe mostrar; si no lo conoce, usa el de respaldo. */
export function toErrorCode(error: unknown, fallback: ErrorCode): ErrorCode {
  if (error instanceof ApiRequestError && error.code in es.errors) {
    return error.code as ErrorCode;
  }
  if (
    error instanceof ApiRequestError &&
    (error.code === 'NETWORK' || error.code === 'NOT_CONFIGURED')
  ) {
    return 'NET_UNAVAILABLE';
  }
  return fallback;
}

export interface ApiDocument {
  id: string;
  courseId: string | null;
  title: string;
  sizeBytes: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalPages: number | null;
  topicCount: number;
  createdAt: string;
}

export interface ApiCourse {
  id: string;
  title: string;
  createdAt: string;
}

/** Bloque del resumen de un tema (la estructura del original: tablas, fórmulas, figuras). */
export type ApiSummaryBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string; pages: number[] }
  | { type: 'list'; items: string[]; pages: number[] }
  | { type: 'table'; header: string[]; rows: string[][]; pages: number[] }
  | { type: 'formula'; text: string; pages: number[] }
  | { type: 'figure'; page: number; caption: string; url: string; width: number; height: number };

export interface ApiTopicSummary {
  topic: ApiTopic;
  path: string[];
  blocks: ApiSummaryBlock[];
  /** Páginas citadas, para comprobarlas en el original (enlaces temporales). */
  pageImages: { pageNumber: number; url: string; width: number; height: number }[];
  document: { id: string; title: string };
}

export interface ApiTopic {
  id: string;
  parentId: string | null;
  title: string;
  sourcePages: number[];
}

export interface ApiUsage {
  questionsToday: number;
  questionsLimit: number;
  storageBytes: number;
  storageLimit: number;
}

export interface ApiClaim {
  /** Término que explica (validado contra la cita). */
  label?: string;
  /** Notación o fórmula (validada contra la cita). */
  formula?: string;
  text: string;
  citations: { chunkId: string; documentId: string; pageNumber: number; quote: string }[];
}

/** Por qué el servidor no respondió con los apuntes. */
export type AbstainReason = 'empty_question' | 'no_matches' | 'validation_failed';

export type SmallTalkKind = 'greeting' | 'thanks' | 'identity' | 'farewell';

export type ApiAnswer =
  | { status: 'answered'; claims: ApiClaim[] }
  /** Sin respaldo en los apuntes; `reason` dice por qué (si el servidor lo manda). */
  | { status: 'abstained'; message: string; reason?: AbstainReason }
  /** Saludo o cortesía: se responde con un texto de la app, sin buscar ni gastar cuota. */
  | { status: 'small_talk'; kind: SmallTalkKind };

export interface ApiExternal {
  source: 'internet';
  results: { title: string; url: string; snippet: string }[];
}

export interface ApiUploadTicket {
  documentId: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}

/** Documentos legales que el usuario acepta (con la versión vigente de `i18n/legal.ts`). */
export type LegalDocument = 'terms' | 'privacy';

export interface ApiConsent {
  document: LegalDocument;
  version: string;
  acceptedAt: string;
}

// --- Panel de administración (solo metadatos, conteos y estados; nunca contenido) ---------

export type ApiDocumentStatus = ApiDocument['status'];

export interface ApiAdminMe {
  admin: true;
  email: string;
}

export interface ApiAdminStats {
  users: number;
  documents: Record<'total' | ApiDocumentStatus, number>;
  storageBytes: number;
  questionsToday: number;
  consents: { currentVersionUsers: number };
}

export interface ApiAdminUser {
  id: string;
  /** `null` si la cuenta de Supabase no tiene correo (p. ej. solo teléfono). */
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string;
  documents: number;
  storageBytes: number;
  questionsToday: number;
  consentVersion: string | null;
}

export interface ApiAdminDocument {
  id: string;
  userId: string;
  /** Nombre del archivo que puso el usuario (metadato; nunca el contenido). */
  title: string;
  sizeBytes: number;
  status: ApiDocumentStatus;
  totalPages: number | null;
  topicCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface ApiAdminAuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface ApiAdminWaitlistEntry {
  id: string;
  email: string;
  consent: boolean;
  source: string;
  createdAt: string;
}

/** Tamaño de página de las listas del panel. */
export const ADMIN_PER_PAGE = 50;

function pageQuery(page: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    ...extra,
    page: String(page),
    perPage: String(ADMIN_PER_PAGE),
  });
  return `?${params.toString()}`;
}

/** Opciones de una petición: cancelarla desde fuera y/o ponerle un tiempo máximo. */
export interface RequestOptions {
  /** Al abortarse, la petición falla con `CANCELLED`. */
  signal?: AbortSignal;
  /** Tiempo máximo en ms; al vencer, la petición falla con `TIMEOUT`. */
  timeoutMs?: number;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  if (!config.apiUrl) throw new ApiRequestError('NOT_CONFIGURED', 0);
  const { signal, timeoutMs } = options;
  if (signal?.aborted) throw new ApiRequestError('CANCELLED', 0);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Un solo controlador junta la señal de quien llama y el tiempo máximo
  // (`AbortSignal.any` puede no existir en React Native).
  const controller = new AbortController();
  let reason: 'CANCELLED' | 'TIMEOUT' | null = null;
  const onAbort = (): void => {
    reason ??= 'CANCELLED';
    controller.abort();
  };
  signal?.addEventListener('abort', onAbort);
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          reason ??= 'TIMEOUT';
          controller.abort();
        }, timeoutMs);
  if (signal?.aborted) onAbort();
  try {
    let response: Response;
    try {
      response = await fetch(`${config.apiUrl}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch {
      throw new ApiRequestError(reason ?? 'NETWORK', 0);
    }
    if (response.status === 204) return undefined as T;
    const json: unknown = await response.json().catch(() => null);
    // Si se canceló o venció mientras llegaba el cuerpo, gana la cancelación.
    if (reason) throw new ApiRequestError(reason, 0);
    if (!response.ok) {
      const code =
        typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: { code?: unknown } }).error.code ?? 'INTERNAL')
          : 'INTERNAL';
      throw new ApiRequestError(code, response.status);
    }
    return json as T;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const api = {
  usage: () => request<ApiUsage>('GET', '/v1/me/usage'),
  deleteAccount: () => request<void>('DELETE', '/v1/account'),
  /** Todo lo que el servidor guarda de esta cuenta (derecho de acceso). */
  exportAccount: () => request<unknown>('GET', '/v1/account/export'),
  courses: () => request<{ courses: ApiCourse[] }>('GET', '/v1/courses'),
  createCourse: (title: string) => request<ApiCourse>('POST', '/v1/courses', { title }),
  documents: () => request<{ documents: ApiDocument[] }>('GET', '/v1/documents'),
  document: (id: string) => request<ApiDocument>('GET', `/v1/documents/${id}`),
  topics: (id: string) => request<{ topics: ApiTopic[] }>('GET', `/v1/documents/${id}/topics`),
  topicSummary: (documentId: string, topicId: string) =>
    request<ApiTopicSummary>('GET', `/v1/documents/${documentId}/topics/${topicId}/summary`),
  createDocument: (input: { fileName: string; sizeBytes: number; courseId?: string }) =>
    request<ApiUploadTicket>('POST', '/v1/documents', input),
  completeDocument: (id: string) => request<unknown>('POST', `/v1/documents/${id}/complete`),
  updateDocument: (id: string, patch: { title?: string; courseId?: string | null }) =>
    request<ApiDocument>('PATCH', `/v1/documents/${id}`, patch),
  deleteDocument: (id: string) => request<void>('DELETE', `/v1/documents/${id}`),
  page: (documentId: string, page: number) =>
    request<{ pageNumber: number; url: string; width: number; height: number }>(
      'GET',
      `/v1/documents/${documentId}/pages/${page}`,
    ),
  ask: (question: string, options?: RequestOptions) =>
    request<ApiAnswer>('POST', '/v1/questions', { question }, options),
  external: (question: string, options?: RequestOptions) =>
    request<ApiExternal>('POST', '/v1/external', { question }, options),
  /** Registra la aceptación (idempotente: repetirla con la misma versión no duplica). */
  acceptConsent: (document: LegalDocument, version: string) =>
    request<ApiConsent>('POST', '/v1/consents', { document, version }),
  consents: () => request<{ consents: ApiConsent[] }>('GET', '/v1/consents'),
  /** Pública (no hace falta sesión) e idempotente: repetir el correo no lo duplica. */
  joinWaitlist: (input: { email: string; consent: true; source: 'app' | 'web' }) =>
    request<{ status: 'joined' }>('POST', '/v1/waitlist', input),
  /** 200 si la cuenta es administradora; 403 FORBIDDEN si no. */
  adminMe: () => request<ApiAdminMe>('GET', '/v1/admin/me'),
  adminStats: () => request<ApiAdminStats>('GET', '/v1/admin/stats'),
  adminUsers: (page: number) =>
    request<{ users: ApiAdminUser[]; page: number; hasMore: boolean }>(
      'GET',
      `/v1/admin/users${pageQuery(page)}`,
    ),
  adminDocuments: (status: ApiDocumentStatus | null, page: number) =>
    request<{ documents: ApiAdminDocument[]; page: number; hasMore: boolean }>(
      'GET',
      `/v1/admin/documents${pageQuery(page, status ? { status } : {})}`,
    ),
  /** 202: el documento vuelve a la cola (solo los que fallaron). */
  adminRetryDocument: (id: string) =>
    request<{ id: string; status: 'pending' }>(
      'POST',
      `/v1/admin/documents/${encodeURIComponent(id)}/retry`,
    ),
  /** 204: borra la cuenta completa de ese usuario (irreversible). */
  adminDeleteUser: (id: string) =>
    request<void>('DELETE', `/v1/admin/users/${encodeURIComponent(id)}`),
  adminWaitlist: (page: number) =>
    request<{ entries: ApiAdminWaitlistEntry[]; page: number; hasMore: boolean }>(
      'GET',
      `/v1/admin/waitlist${pageQuery(page)}`,
    ),
  /** 204: borra esa inscripción de la lista de espera. */
  adminDeleteWaitlistEntry: (id: string) =>
    request<void>('DELETE', `/v1/admin/waitlist/${encodeURIComponent(id)}`),
  adminAudit: (page: number) =>
    request<{ entries: ApiAdminAuditEntry[]; page: number; hasMore: boolean }>(
      'GET',
      `/v1/admin/audit${pageQuery(page)}`,
    ),
};
