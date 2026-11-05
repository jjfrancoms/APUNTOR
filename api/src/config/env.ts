import { z } from 'zod';

const serverEnvSchema = z.object({
  /** Pooler de Supabase en modo transacción, para las consultas de la app. */
  DATABASE_URL: z.url(),
  /** Conexión directa o de sesión: pg-boss necesita sesiones largas. */
  QUEUE_DATABASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  GOOGLE_CLOUD_PROJECT: z.string().min(1),
  /** Sin valor por defecto: la disponibilidad por región sigue sin verificarse. */
  GOOGLE_CLOUD_LOCATION: z.string().min(1),
  /** Opcional: sin clave, el contexto externo queda desactivado. */
  TAVILY_API_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Orígenes web permitidos, separados por comas. */
  CORS_ORIGINS: z.string().default(''),
});

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
