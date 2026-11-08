import { z } from 'zod';

const serverEnvSchema = z
  .object({
    /** Pooler de Supabase en modo transacción, para las consultas de la app. */
    DATABASE_URL: z.url(),
    /** Conexión directa o de sesión: pg-boss necesita sesiones largas. */
    QUEUE_DATABASE_URL: z.url(),
    SUPABASE_URL: z.url(),
    /** Solo para borrar cuentas de Supabase Auth. Nunca va en la app. */
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    /**
     * IA: con GEMINI_API_KEY se usa la API de Gemini (Google AI Studio, tiene plan gratis);
     * sin ella, Vertex AI con GOOGLE_CLOUD_PROJECT y GOOGLE_CLOUD_LOCATION (requiere facturación).
     * El plan gratis de la API de Gemini puede usar el contenido para mejorar los productos de
     * Google: solo para pruebas, nunca con apuntes de estudiantes reales.
     */
    GEMINI_API_KEY: z.string().min(1).optional(),
    /** Modelo de respuestas y OCR; por defecto el de la especificación (gemini-2.5-flash). */
    GENERATION_MODEL: z.string().min(1).optional(),
    /**
     * Modelo rápido: lo que el estudiante espera (chat). Por defecto CHAT_MODEL o el de
     * generación. Ver `resolveModels()` en `api/src/llm/models.ts`.
     */
    MODEL_FAST: z.string().min(1).optional(),
    /** Modelo fuerte: trabajo que se hace una vez y se guarda (OCR, resúmenes). */
    MODEL_STRONG: z.string().min(1).optional(),
    /** Modelo del chat (por defecto, el rápido). */
    CHAT_MODEL: z.string().min(1).optional(),
    /** Modelo de los resúmenes de tema (por defecto, el fuerte). */
    SUMMARY_MODEL: z.string().min(1).optional(),
    GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
    /** Sin valor por defecto: la disponibilidad por región sigue sin verificarse. */
    GOOGLE_CLOUD_LOCATION: z.string().min(1).optional(),
    /** Opcional: sin clave, el contexto externo queda desactivado. */
    TAVILY_API_KEY: z.string().min(1).optional(),
    PORT: z.coerce.number().int().positive().default(3001),
    /** Correos de los administradores (panel /v1/admin/*), separados por comas. */
    ADMIN_EMAILS: z.string().default(''),
    /** Orígenes web permitidos, separados por comas. */
    CORS_ORIGINS: z.string().default(''),
  })
  .refine(
    (env) =>
      env.GEMINI_API_KEY !== undefined ||
      (env.GOOGLE_CLOUD_PROJECT !== undefined && env.GOOGLE_CLOUD_LOCATION !== undefined),
    {
      path: ['GEMINI_API_KEY'],
      message: 'Falta GEMINI_API_KEY o GOOGLE_CLOUD_PROJECT + _LOCATION',
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valida las variables al arrancar cada proceso; los tests no exigen secretos. */
export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Variables de entorno inválidas o ausentes: ${fields}`);
  }
  return parsed.data;
}
