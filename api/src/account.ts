import type { DocumentsRepository } from './documents';
import type { FileStorage } from './storage/file-storage';

/** Borra el usuario de Supabase Auth. Necesita la service role key: solo en el servidor. */
export type AuthUserDeleter = (userId: string) => Promise<void>;

export function createSupabaseUserDeleter(
  supabaseUrl: string,
  serviceRoleKey: string,
): AuthUserDeleter {
  const base = supabaseUrl.replace(/\/+$/u, '');
  return async (userId) => {
    const response = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });
    // 404: ya no existía, el resultado buscado es el mismo.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase no borró el usuario (HTTP ${response.status})`);
    }
  };
}

export interface AccountDeletionDeps {
  documents: Pick<DocumentsRepository, 'list' | 'deleteAllForUser'>;
  storage: Pick<FileStorage, 'delete'>;
  deleteAuthUser: AuthUserDeleter;
}

/**
 * Borra archivos de R2, datos y el usuario de Supabase Auth, en ese orden: si algo falla, se
 * puede reintentar porque la cuenta sigue existiendo. La usan `DELETE /v1/account` y el panel
 * de administrador.
 */
export async function deleteUserAccount(deps: AccountDeletionDeps, userId: string): Promise<void> {
  for (const document of await deps.documents.list(userId)) {
    await deps.storage.delete(document.filePath);
  }
  await deps.documents.deleteAllForUser(userId);
  await deps.deleteAuthUser(userId);
}
