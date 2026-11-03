-- Verifica el aislamiento por usuario. Falla (ON_ERROR_STOP) si algo se filtra.
-- Corre dentro de una transacción que se revierte: no deja datos.
BEGIN;

INSERT INTO documents (id, user_id, title, file_path, status) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'A', 'u1/a.pdf', 'completed'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'B', 'u2/b.pdf', 'completed');

INSERT INTO document_chunks (document_id, page_number, chunk_index, content, token_count, metadata, embedding)
SELECT d.id, 1, 0, 'texto', 1, '{"sectionPath":[],"charStart":0,"charEnd":5}'::jsonb,
       array_fill(0.1::real, ARRAY[768])::vector
FROM documents d;

INSERT INTO topics (document_id, title, source_pages)
SELECT id, 'Tema', '{1}' FROM documents;

-- Usuario 1 autenticado
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM documents) <> 1 THEN RAISE EXCEPTION 'RLS documents: ve documentos ajenos'; END IF;
  IF (SELECT count(*) FROM document_chunks) <> 1 THEN RAISE EXCEPTION 'RLS chunks: ve chunks ajenos'; END IF;
  IF (SELECT count(*) FROM topics) <> 1 THEN RAISE EXCEPTION 'RLS topics: ve temas ajenos'; END IF;
END $$;

-- No puede borrar documentos de otro usuario (0 filas afectadas)…
DELETE FROM documents WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002';
-- …ni insertar directamente (las escrituras van por el backend).
DO $$
BEGIN
  BEGIN
    INSERT INTO documents (user_id, title, file_path)
    VALUES ('11111111-1111-4111-8111-111111111111', 'x', 'x.pdf');
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en documents';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- anon no ve nada
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM documents;
    RAISE EXCEPTION 'RLS: anon pudo leer documents';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM documents) <> 2 THEN RAISE EXCEPTION 'RLS: un usuario borró un documento ajeno'; END IF;
END $$;

ROLLBACK;
\echo 'RLS OK: aislamiento por usuario verificado'
