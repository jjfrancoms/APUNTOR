/**
 * Códigos estables de docs/producto/mvp-ux.md §4: son la clave de traducción en la app.
 * AUTH_REQUIRED, REQ_INVALID, DOC_NOT_FOUND, DOC_STATE, COURSE_NOT_FOUND, EXTERNAL_UNAVAILABLE,
 * RATE_LIMITED, FORBIDDEN, ADMIN_TARGET_IS_SELF e INTERNAL son provisionales.
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
  | 'CHAT_CANCELLED'
  /** Se acabaron los resúmenes nuevos de hoy (los ya generados se siguen viendo gratis). */
  | 'SUMMARY_DAILY_LIMIT'
  /** Demasiadas peticiones en poco tiempo: reintentar en unos segundos (cabecera Retry-After). */
  | 'RATE_LIMITED'
  /** Con sesión, pero sin permiso: rutas /v1/admin/* para quien no está en ADMIN_EMAILS. */
  | 'FORBIDDEN'
  /** Un administrador intentó borrarse a sí mismo desde el panel (usa DELETE /v1/account). */
  | 'ADMIN_TARGET_IS_SELF'
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
