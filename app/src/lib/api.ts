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
  text: string;
  citations: { chunkId: string; documentId: string; pageNumber: number; quote: string }[];
}

export type ApiAnswer =
  { status: 'answered'; claims: ApiClaim[] } | { status: 'abstained'; message: string };

export interface ApiExternal {
  source: 'internet';
  results: { title: string; url: string; snippet: string }[];
}

export interface ApiUploadTicket {
  documentId: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!config.apiUrl) throw new ApiRequestError('NOT_CONFIGURED', 0);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiRequestError('NETWORK', 0);
  }
  if (response.status === 204) return undefined as T;
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error: { code?: unknown } }).error.code ?? 'INTERNAL')
        : 'INTERNAL';
    throw new ApiRequestError(code, response.status);
  }
  return json as T;
}

export const api = {
  usage: () => request<ApiUsage>('GET', '/v1/me/usage'),
  deleteAccount: () => request<void>('DELETE', '/v1/account'),
  courses: () => request<{ courses: ApiCourse[] }>('GET', '/v1/courses'),
  createCourse: (title: string) => request<ApiCourse>('POST', '/v1/courses', { title }),
  documents: () => request<{ documents: ApiDocument[] }>('GET', '/v1/documents'),
  document: (id: string) => request<ApiDocument>('GET', `/v1/documents/${id}`),
  topics: (id: string) => request<{ topics: ApiTopic[] }>('GET', `/v1/documents/${id}/topics`),
  createDocument: (input: { fileName: string; sizeBytes: number; courseId?: string }) =>
    request<ApiUploadTicket>('POST', '/v1/documents', input),
  completeDocument: (id: string) => request<unknown>('POST', `/v1/documents/${id}/complete`),
  updateDocument: (id: string, patch: { title?: string; courseId?: string | null }) =>
    request<ApiDocument>('PATCH', `/v1/documents/${id}`, patch),
  deleteDocument: (id: string) => request<void>('DELETE', `/v1/documents/${id}`),
  ask: (question: string) => request<ApiAnswer>('POST', '/v1/questions', { question }),
  external: (question: string) => request<ApiExternal>('POST', '/v1/external', { question }),
};
