import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Crea un cliente Drizzle. `prepare: false` es obligatorio con el pooler de
 * Supabase en modo transacción (PgBouncer no soporta prepared statements).
 */
export function createDatabase(databaseUrl: string, options: { max?: number } = {}): Database {
  const sqlClient = postgres(databaseUrl, { prepare: false, max: options.max ?? 10 });
  return drizzle(sqlClient, { schema });
}
