/**
 * Códigos estables de docs/producto/mvp-ux.md §4: son la clave de traducción en la app.
 * AUTH_REQUIRED, REQ_INVALID, DOC_NOT_FOUND, DOC_STATE e INTERNAL son provisionales.
 */
export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'REQ_INVALID'
  | 'DOC_NOT_FOUND'
  | 'DOC_STATE'
  | 'UP_FORMAT'
  | 'UP_SIZE'
  | 'UP_QUOTA'
  | 'UP_NETWORK'
  | 'CHAT_DAILY_LIMIT'
  | 'CHAT_FAILED'
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
