import { and, count, desc, eq, inArray, max, sql, sum } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../../db/client';
import {
  adminAudit,
  CONSENT_DOCUMENTS,
  consents,
  documents,
  documentStatusEnum,
  usageQuotas,
  type DocumentStatus,
} from '../../db/schema';

/*
 * Panel de administrador. Principio de privacidad (lo promete la política): el administrador
 * nunca ve el contenido de los documentos (fragmentos), ni las preguntas o respuestas, ni los
 * archivos. Aquí solo hay metadatos, conteos y estados: ninguna consulta toca `document_chunks`,
 * `topics.title`/`summary` ni el contenido en R2.
 */

export const DOCUMENT_STATUSES = documentStatusEnum.enumValues;
export const MAX_ADMIN_PER_PAGE = 100;
export const DEFAULT_ADMIN_PER_PAGE = 50;

/** `ADMIN_EMAILS` separado por comas; se comparan sin mayúsculas ni espacios. */
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isAdminEmail(admins: ReadonlySet<string>, email: string | null): boolean {
  return email !== null && admins.has(email.trim().toLowerCase());
}

// --- Usuarios de Supabase Auth --------------------------------------------------------

export interface AuthUserRecord {
  id: string;
  email: string | null;
  createdAt: Date;
  lastSignInAt: Date | null;
  /** 'email', 'google' u otro proveedor de Supabase. */
  provider: string;
}

export interface AuthUserPage {
  users: AuthUserRecord[];
  /** Total de usuarios, si Supabase lo informa (cabecera `X-Total-Count`). */
  total: number | null;
}

/** Lo que la Admin API dice de una cuenta: sirve para confirmar a un administrador. */
export interface AuthUserIdentity {
  id: string;
  email: string | null;
  /** Fecha en que confirmó su correo; `null` si nunca lo confirmó. */
  emailConfirmedAt: Date | null;
}

/** Usuarios de Supabase Auth (Admin API). Inyectada para simularla en las pruebas. */
export interface AuthUsersDirectory {
  /** `page` empieza en 1. */
  list(page: number, perPage: number): Promise<AuthUserPage>;
  /** Una cuenta por id; `null` si no existe. */
  get(userId: string): Promise<AuthUserIdentity | null>;
}

/** Cuánto se recuerda la verificación de un administrador antes de volver a la Admin API. */
export const ADMIN_VERIFY_TTL_MS = 5 * 60_000;

export interface AdminGateOptions {
  adminEmails: readonly string[];
  directory: Pick<AuthUsersDirectory, 'get'>;
  ttlMs?: number;
  /** Reloj inyectable para las pruebas. */
  now?: () => number;
}

/**
 * Decide si una sesión es de administrador. El claim `email` del JWT no basta: además la
 * Admin API debe confirmar que esa cuenta tiene el correo CONFIRMADO y que es el mismo correo
 * de `ADMIN_EMAILS` (así nadie se hace admin registrando esa dirección sin confirmarla, ni con
 * un token viejo de antes de cambiar el correo). Devuelve el correo verificado o `null`.
 * El resultado se recuerda `ttlMs` por usuario; los errores de la Admin API no se recuerdan.
 */
export interface AdminGate {
  /** Correo verificado del administrador, o `null` si la sesión no es de un admin. */
  check(session: { userId: string; email: string | null }): Promise<string | null>;
  /** Olvida lo recordado de una cuenta (p. ej. al borrarla desde el panel). */
  forget(userId: string): void;
}

export function createAdminGate(options: AdminGateOptions): AdminGate {
  const admins = new Set(parseAdminEmails(options.adminEmails.join(',')));
  const ttlMs = options.ttlMs ?? ADMIN_VERIFY_TTL_MS;
  const now = options.now ?? Date.now;
  // Solo entran cuentas cuyo claim ya está en ADMIN_EMAILS: el tamaño queda acotado.
  const cache = new Map<string, { email: string | null; expiresAt: number }>();

  async function verifiedEmail(userId: string): Promise<string | null> {
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > now()) return cached.email;
    const user = await options.directory.get(userId);
    const email =
      user !== null &&
      user.id === userId &&
      user.emailConfirmedAt !== null &&
      isAdminEmail(admins, user.email)
        ? user.email
        : null;
    cache.set(userId, { email, expiresAt: now() + ttlMs });
    return email;
  }

  async function check(session: { userId: string; email: string | null }) {
    // Sin el claim en la lista ni se consulta la Admin API: 403 barato.
    if (session.email === null || !isAdminEmail(admins, session.email)) return null;
    const email = await verifiedEmail(session.userId);
    if (email === null) return null;
    return email.trim().toLowerCase() === session.email.trim().toLowerCase() ? email : null;
  }

  return { check, forget: (userId) => void cache.delete(userId) };
}

/** Si hay más páginas después de `page`. */
export function authHasMore(result: AuthUserPage, page: number, perPage: number): boolean {
  return result.total === null ? result.users.length === perPage : page * perPage < result.total;
}

/** Total de usuarios: usa el que informa Supabase y, si no viene, recorre las páginas. */
export async function countAuthUsers(directory: Pick<AuthUsersDirectory, 'list'>): Promise<number> {
  const first = await directory.list(1, 1);
  if (first.total !== null) return first.total;
  const perPage = 1000;
  let total = 0;
  for (let page = 1; ; page += 1) {
    const { users } = await directory.list(page, perPage);
    total += users.length;
    if (users.length < perPage) return total;
  }
}

const supabaseUserSchema = z.object({
  id: z.uuid(),
  email: z.string().nullish(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullish(),
  app_metadata: z.object({ provider: z.string().optional() }).nullish(),
});
const supabaseUsersSchema = z.object({ users: z.array(supabaseUserSchema) });
const supabaseIdentitySchema = z.object({
  id: z.uuid(),
  email: z.string().nullish(),
  email_confirmed_at: z.string().nullish(),
});

/** Admin API de Supabase con la service role key: solo en el servidor. */
export function createSupabaseUsersDirectory(
  supabaseUrl: string,
  serviceRoleKey: string,
): AuthUsersDirectory {
  const base = supabaseUrl.replace(/\/+$/u, '');
  const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
  return {
    async get(userId) {
      const url = `${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
      const response = await fetch(url, { headers });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Supabase no devolvió el usuario (HTTP ${response.status})`);
      }
      const user = supabaseIdentitySchema.parse(await response.json());
      const confirmed = user.email_confirmed_at ? new Date(user.email_confirmed_at) : null;
      return {
        id: user.id,
        email: user.email ?? null,
        emailConfirmedAt: confirmed && !Number.isNaN(confirmed.getTime()) ? confirmed : null,
      };
    },
    async list(page, perPage) {
      const url = `${base}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Supabase no listó los usuarios (HTTP ${response.status})`);
      }
      const body = supabaseUsersSchema.parse(await response.json());
      const totalHeader = Number(response.headers.get('x-total-count') ?? Number.NaN);
      return {
        users: body.users.map((user) => ({
          id: user.id,
          email: user.email ?? null,
          createdAt: new Date(user.created_at),
          lastSignInAt: user.last_sign_in_at ? new Date(user.last_sign_in_at) : null,
          provider: user.app_metadata?.provider ?? 'email',
        })),
        total: Number.isInteger(totalHeader) && totalHeader >= 0 ? totalHeader : null,
      };
    },
  };
}

// --- Datos de la base ------------------------------------------------------------------

export interface AdminStats {
  documents: Record<DocumentStatus, number> & { total: number };
  storageBytes: number;
  questionsToday: number;
  consents: { currentVersionUsers: number };
}

export interface AdminUserSummary {
  documents: number;
  storageBytes: number;
  questionsToday: number;
  /** Versión más reciente en la que aceptó términos y privacidad; `null` si ninguna. */
  consentVersion: string | null;
}

/** Metadatos de un documento: sin ruta del archivo ni contenido. */
export interface AdminDocumentRecord {
  id: string;
  userId: string;
  title: string;
  sizeBytes: number;
  status: DocumentStatus;
  totalPages: number | null;
  topicCount: number;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AdminAuditRecord {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  createdAt: Date;
}

export type RetryResult = 'retried' | 'not_failed' | 'not_found';
export type ReprocessResult = 'reprocessing' | 'not_completed' | 'not_found';

export interface AdminRepository {
  /** `today` es el periodo de las preguntas (día de Perú, AAAA-MM-DD). */
  stats(today: string): Promise<AdminStats>;
  userSummaries(userIds: readonly string[], today: string): Promise<Map<string, AdminUserSummary>>;
  /** Devuelve hasta `limit` documentos, del más nuevo al más viejo. */
  listDocuments(options: {
    status?: DocumentStatus;
    limit: number;
    offset: number;
  }): Promise<AdminDocumentRecord[]>;
  /** Solo si está fallido: lo deja en `pending` y sin error (atómico). */
  retryFailedDocument(documentId: string): Promise<RetryResult>;
  /** Vuelve a `pending` un documento `completed` para regenerar todo lo derivado. */
  reprocessCompletedDocument(documentId: string): Promise<ReprocessResult>;
  /** Deshace lo anterior si no se pudo encolar: sus fragmentos siguen intactos. */
  restoreCompletedDocument(documentId: string): Promise<void>;
  recordAudit(entry: {
    adminUserId: string;
    adminEmail: string;
    action: string;
    target: string;
  }): Promise<void>;
  listAudit(options: { limit: number; offset: number }): Promise<AdminAuditRecord[]>;
}

const adminDocumentColumns = {
  id: documents.id,
  userId: documents.userId,
  title: documents.title,
  sizeBytes: documents.sizeBytes,
  status: documents.status,
  totalPages: documents.totalPages,
  // Mismo truco que en documents.ts: la tabla va escrita para que `id` no sea el del tema.
  topicCount:
    sql<number>`(SELECT count(*) FROM topics t WHERE t.document_id = "documents"."id")`.mapWith(
      Number,
    ),
  errorMessage: documents.errorMessage,
  createdAt: documents.createdAt,
};

/** Usuarios con todos los documentos legales aceptados en una misma versión. */
const allConsentDocuments = sql`count(DISTINCT ${consents.document}) = ${CONSENT_DOCUMENTS.length}`;

/**
 * Consultas del panel. Son las únicas que leen datos de todos los usuarios: por eso solo
 * devuelven conteos y metadatos, y solo las llaman rutas que exigen ser administrador.
 */
export function createAdminRepository(db: Database): AdminRepository {
  return {
    async stats(today) {
      const byStatus = await db
        .select({
          status: documents.status,
          count: count().mapWith(Number),
          bytes: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)`.mapWith(Number),
        })
        .from(documents)
        .groupBy(documents.status);
      const counts: AdminStats['documents'] = {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };
      let storageBytes = 0;
      for (const row of byStatus) {
        counts[row.status] = row.count;
        counts.total += row.count;
        storageBytes += row.bytes;
      }

      const questions = await db
        .select({ total: sum(usageQuotas.used).mapWith(Number) })
        .from(usageQuotas)
        .where(and(eq(usageQuotas.kind, 'questions'), eq(usageQuotas.periodStart, today)));

      // Las versiones son fechas ISO: la mayor es la más reciente.
      const latest = await db.select({ version: max(consents.version) }).from(consents);
      const version = latest[0]?.version ?? null;
      let currentVersionUsers = 0;
      if (version !== null) {
        const accepted = db
          .select({ userId: consents.userId })
          .from(consents)
          .where(eq(consents.version, version))
          .groupBy(consents.userId)
          .having(allConsentDocuments)
          .as('accepted');
        const rows = await db.select({ total: count().mapWith(Number) }).from(accepted);
        currentVersionUsers = rows[0]?.total ?? 0;
      }

      return {
        documents: counts,
        storageBytes,
        questionsToday: questions[0]?.total ?? 0,
        consents: { currentVersionUsers },
      };
    },

    async userSummaries(userIds, today) {
      const result = new Map<string, AdminUserSummary>();
      if (userIds.length === 0) return result;
      const ids = [...userIds];
      for (const id of ids) {
        result.set(id, { documents: 0, storageBytes: 0, questionsToday: 0, consentVersion: null });
      }

      const docs = await db
        .select({
          userId: documents.userId,
          count: count().mapWith(Number),
          bytes: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)`.mapWith(Number),
        })
        .from(documents)
        .where(inArray(documents.userId, ids))
        .groupBy(documents.userId);
      for (const row of docs) {
        const summary = result.get(row.userId);
        if (summary) {
          summary.documents = row.count;
          summary.storageBytes = row.bytes;
        }
      }

      const questions = await db
        .select({ userId: usageQuotas.userId, used: usageQuotas.used })
        .from(usageQuotas)
        .where(
          and(
            inArray(usageQuotas.userId, ids),
            eq(usageQuotas.kind, 'questions'),
            eq(usageQuotas.periodStart, today),
          ),
        );
      for (const row of questions) {
        const summary = result.get(row.userId);
        if (summary) summary.questionsToday = row.used;
      }

      const versions = await db
        .select({ userId: consents.userId, version: consents.version })
        .from(consents)
        .where(inArray(consents.userId, ids))
        .groupBy(consents.userId, consents.version)
        .having(allConsentDocuments);
      for (const row of versions) {
        const summary = result.get(row.userId);
        if (summary && (summary.consentVersion === null || row.version > summary.consentVersion)) {
          summary.consentVersion = row.version;
        }
      }
      return result;
    },

    listDocuments({ status, limit, offset }) {
      return db
        .select(adminDocumentColumns)
        .from(documents)
        .where(status === undefined ? undefined : eq(documents.status, status))
        .orderBy(desc(documents.createdAt), desc(documents.id))
        .limit(limit)
        .offset(offset);
    },

    async retryFailedDocument(documentId) {
      const updated = await db
        .update(documents)
        .set({ status: 'pending', errorMessage: null, updatedAt: sql`now()` })
        .where(and(eq(documents.id, documentId), eq(documents.status, 'failed')))
        .returning({ id: documents.id });
      if (updated.length > 0) return 'retried';
      const existing = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);
      return existing.length > 0 ? 'not_failed' : 'not_found';
    },

    async reprocessCompletedDocument(documentId) {
      const updated = await db
        .update(documents)
        .set({ status: 'pending', errorMessage: null, updatedAt: sql`now()` })
        .where(and(eq(documents.id, documentId), eq(documents.status, 'completed')))
        .returning({ id: documents.id });
      if (updated.length > 0) return 'reprocessing';
      const existing = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.id, documentId))
        .limit(1);
      return existing.length > 0 ? 'not_completed' : 'not_found';
    },

    async restoreCompletedDocument(documentId) {
      await db
        .update(documents)
        .set({ status: 'completed', updatedAt: sql`now()` })
        .where(and(eq(documents.id, documentId), eq(documents.status, 'pending')));
    },

    async recordAudit(entry) {
      await db.insert(adminAudit).values(entry);
    },

    listAudit({ limit, offset }) {
      return db
        .select({
          id: adminAudit.id,
          adminEmail: adminAudit.adminEmail,
          action: adminAudit.action,
          target: adminAudit.target,
          createdAt: adminAudit.createdAt,
        })
        .from(adminAudit)
        .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
        .limit(limit)
        .offset(offset);
    },
  };
}
