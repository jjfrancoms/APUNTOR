-- Habilita pgvector antes de crear cualquier columna `vector`.
-- En Supabase la extensión vive normalmente en el schema `extensions`; IF NOT EXISTS la hace idempotente.
CREATE EXTENSION IF NOT EXISTS vector;
