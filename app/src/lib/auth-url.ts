/**
 * Lectura de los parámetros que Supabase agrega al volver a la app (enlace del correo o
 * regreso de Google). Sin dependencias de Expo para poder probarlo en Node.
 */
export interface AuthUrlParams {
  /** Código PKCE que se cambia por la sesión con exchangeCodeForSession. */
  code: string | null;
  /** Identificador del flujo PKCE (`sb_flow_id`), si Supabase lo agrega. */
  flowId: string | null;
  /** Error que devolvió Supabase o el proveedor (enlace vencido, acceso cancelado…). */
  error: string | null;
}

function paramsOf(part: string | undefined): URLSearchParams {
  return new URLSearchParams(part ?? '');
}

/** Busca los parámetros tanto en la consulta (`?code=`) como en el fragmento (`#error=`). */
export function authParamsFromUrl(url: string): AuthUrlParams {
  const [beforeHash, hash] = url.split('#', 2) as [string, string | undefined];
  const query = beforeHash.includes('?') ? beforeHash.slice(beforeHash.indexOf('?') + 1) : '';
  const sources = [paramsOf(query), paramsOf(hash)];
  const read = (key: string): string | null => {
    for (const p of sources) {
      const v = p.get(key);
      if (v) return v;
    }
    return null;
  };
  return {
    code: read('code'),
    flowId: read('sb_flow_id'),
    error: read('error_code') ?? read('error'),
  };
}
