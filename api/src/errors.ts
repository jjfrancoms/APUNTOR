/**
 * Códigos estables de docs/producto/mvp-ux.md §4: son la clave de traducción en la app.
 * AUTH_REQUIRED, REQ_INVALID, DOC_NOT_FOUND, DOC_STATE, COURSE_NOT_FOUND, EXTERNAL_UNAVAILABLE,
 * RATE_LIMITED e INTERNAL son provisionales.
 */
export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'REQ_INVALID'
  | 'DOC_NOT_FOUND'
  | 'DOC_STATE'
  | 'COURSE_NOT_FOUND'
  | 'EXTERNAL_UNAVAILABLE'
  | 'UP_FORMAT'
  | 'UP_SIZE'
  | 'UP_QUOTA'
  | 'UP_NETWORK'
  | 'CHAT_DAILY_LIMIT'
  | 'CHAT_FAILED'
  /** Demasiadas peticiones en poco tiempo: reintentar en unos segundos (cabecera Retry-After). */
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
