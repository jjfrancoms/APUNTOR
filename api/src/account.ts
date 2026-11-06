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
