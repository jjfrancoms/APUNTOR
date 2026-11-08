/**
 * Códigos estables de docs/producto/mvp-ux.md §4: son la clave de traducción en la app.
 * AUTH_REQUIRED, REQ_INVALID, DOC_NOT_FOUND, DOC_STATE, COURSE_NOT_FOUND, EXTERNAL_UNAVAILABLE,
 * RATE_LIMITED, FORBIDDEN, ADMIN_TARGET_IS_SELF, STUDY_* e INTERNAL son provisionales.
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
  /** Conversación inexistente o de otro usuario. */
  | 'CONV_NOT_FOUND'
  /** Se acabaron los resúmenes nuevos de hoy (los ya generados se siguen viendo gratis). */
  | 'SUMMARY_DAILY_LIMIT'
  /** Demasiadas peticiones en poco tiempo: reintentar en unos segundos (cabecera Retry-After). */
  | 'RATE_LIMITED'
  /** Con sesión, pero sin permiso: rutas /v1/admin/* para quien no está en ADMIN_EMAILS. */
  | 'FORBIDDEN'
  /** Un administrador intentó borrarse a sí mismo desde el panel (usa DELETE /v1/account). */
  | 'ADMIN_TARGET_IS_SELF'
  /** Estudio (fase 3): conjunto o tarjeta que no existe o no es del usuario. */
  | 'STUDY_NOT_FOUND'
  /** Se acabaron las generaciones de quiz/tarjetas de hoy. */
  | 'STUDY_DAILY_LIMIT'
  /** El documento o tema no tiene texto del que generar. */
  | 'STUDY_NO_CONTENT'
  /** La IA no produjo al menos 3 elementos con cita válida. */
  | 'STUDY_TOO_FEW_ITEMS'
  | 'STUDY_FAILED'
  /** La inscripción de la lista de espera ya no existe (panel de administrador). */
  | 'WAITLIST_NOT_FOUND'
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
