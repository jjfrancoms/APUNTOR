import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

/** Devuelve el id de usuario del token, o null si no es válido. */
export type Authenticator = (token: string) => Promise<string | null>;

/** Verifica los JWT de Supabase Auth con las claves públicas del proyecto. */
export function createSupabaseAuthenticator(supabaseUrl: string): Authenticator {
  const base = `${supabaseUrl.replace(/\/+$/u, '')}/auth/v1`;
  const keys = createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: base,
        audience: 'authenticated',
      });
      return z.uuid().parse(payload.sub);
    } catch {
      return null;
    }
  };
}
