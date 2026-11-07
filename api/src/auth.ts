import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

/** Lo que la API toma del JWT. Las rutas normales solo usan `userId`; el panel admin, el email. */
export interface AuthSession {
  userId: string;
  /** Claim `email` del JWT de Supabase; `null` si no viene o no es un correo. */
  email: string | null;
}

/** Devuelve la sesión del token, o null si no es válido. */
export type Authenticator = (token: string) => Promise<AuthSession | null>;

const emailClaim = z.email();

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
      const userId = z.uuid().parse(payload.sub);
      const email = emailClaim.safeParse(payload.email);
      return { userId, email: email.success ? email.data : null };
    } catch {
      return null;
    }
  };
}
