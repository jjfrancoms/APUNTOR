-- Búsqueda de la especificación v2.4: umbral + top-K sobre los documentos del usuario.
--
-- La subconsulta interna ordena solo por distancia para que Postgres use el índice
-- HNSW; el umbral se aplica fuera. `iterative_scan` evita perder resultados cuando el
-- filtro por usuario es muy selectivo (requiere pgvector >= 0.8).
-- SECURITY INVOKER: con el rol `authenticated`, RLS sigue aplicándose.

CREATE FUNCTION match_user_chunks(
  p_user_id uuid,
  p_query_embedding vector(768),
  p_match_threshold double precision,
  p_match_count integer,
  p_document_ids uuid[] DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  document_id uuid,
  page_number integer,
  chunk_index integer,
  content text,
  section_title text,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
SET hnsw.iterative_scan = 'relaxed_order'
AS $$
  SELECT m.id, m.document_id, m.page_number, m.chunk_index, m.content, m.section_title,
         1 - m.distance AS similarity
  FROM (
    SELECT c.id, c.document_id, c.page_number, c.chunk_index, c.content, c.section_title,
           c.embedding <=> p_query_embedding AS distance
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE d.user_id = p_user_id
      AND d.status = 'completed'
      AND (p_document_ids IS NULL OR c.document_id = ANY (p_document_ids))
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT least(greatest(p_match_count, 1), 50)
  ) m
  WHERE 1 - m.distance >= p_match_threshold
  ORDER BY m.distance;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION match_user_chunks(uuid, vector, double precision, integer, uuid[]) FROM PUBLIC;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION match_user_chunks(uuid, vector, double precision, integer, uuid[]) TO authenticated;
  END IF;
END
$$;
