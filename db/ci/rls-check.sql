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

INSERT INTO courses (user_id, title) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Curso A'),
  ('22222222-2222-4222-8222-222222222222', 'Curso B');

INSERT INTO usage_quotas (user_id, kind, period_start, used) VALUES
  ('11111111-1111-4111-8111-111111111111', 'questions', '2026-01-01', 1),
  ('22222222-2222-4222-8222-222222222222', 'questions', '2026-01-01', 1);

INSERT INTO consents (user_id, document, version) VALUES
  ('11111111-1111-4111-8111-111111111111', 'terms', '2026-11-01'),
  ('22222222-2222-4222-8222-222222222222', 'terms', '2026-11-01');

INSERT INTO admin_audit (admin_user_id, admin_email, action, target) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@example.com', 'user.delete', 'user:22222222-2222-4222-8222-222222222222');

INSERT INTO conversations (id, user_id, title) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000c1', '11111111-1111-4111-8111-111111111111', 'Chat A'),
  ('bbbbbbbb-0000-4000-8000-0000000000c2', '22222222-2222-4222-8222-222222222222', 'Chat B');

INSERT INTO conversation_messages (id, conversation_id, role, kind, text) VALUES
  ('aaaaaaaa-0000-4000-8000-0000000000d1', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'user', 'text', 'Hola A'),
  ('bbbbbbbb-0000-4000-8000-0000000000d2', 'bbbbbbbb-0000-4000-8000-0000000000c2', 'user', 'text', 'Hola B');
INSERT INTO waitlist (email, consent, source) VALUES ('tutor@example.com', true, 'app');

-- Usuario 1 autenticado
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM documents) <> 1 THEN RAISE EXCEPTION 'RLS documents: ve documentos ajenos'; END IF;
  IF (SELECT count(*) FROM document_chunks) <> 1 THEN RAISE EXCEPTION 'RLS chunks: ve chunks ajenos'; END IF;
  IF (SELECT count(*) FROM topics) <> 1 THEN RAISE EXCEPTION 'RLS topics: ve temas ajenos'; END IF;
  IF (SELECT count(*) FROM courses) <> 1 THEN RAISE EXCEPTION 'RLS cursos: ve cursos ajenos'; END IF;
  IF (SELECT count(*) FROM usage_quotas) <> 1 THEN RAISE EXCEPTION 'RLS cuotas: ve cuotas ajenas'; END IF;
  IF (SELECT count(*) FROM consents) <> 1 THEN RAISE EXCEPTION 'RLS consentimientos: ve consentimientos ajenos'; END IF;
  IF (SELECT count(*) FROM conversations) <> 1 THEN RAISE EXCEPTION 'RLS conversations: ve conversaciones ajenas'; END IF;
  IF (SELECT count(*) FROM conversation_messages) <> 1 THEN RAISE EXCEPTION 'RLS conversation_messages: ve mensajes ajenos'; END IF;
  -- La auditoría del administrador es solo del backend: ni siquiera el propio admin la lee así.
  BEGIN
    IF (SELECT count(*) FROM admin_audit) <> 0 THEN
      RAISE EXCEPTION 'RLS admin_audit: authenticated ve la auditoría';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- La lista de espera es solo del backend: ningún usuario lee los correos.
  BEGIN
    IF (SELECT count(*) FROM waitlist) <> 0 THEN
      RAISE EXCEPTION 'RLS waitlist: authenticated ve la lista de espera';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Aunque pida los fragmentos de otro usuario, RLS no se los entrega.
  IF (SELECT count(*) FROM match_user_chunks(
        '22222222-2222-4222-8222-222222222222',
        array_fill(0.1::real, ARRAY[768])::vector, -1, 10)) <> 0 THEN
    RAISE EXCEPTION 'RLS match_user_chunks: devuelve fragmentos ajenos';
  END IF;
  BEGIN
    PERFORM consume_quota('11111111-1111-4111-8111-111111111111', 'questions', '2026-01-01', 1, 100);
    RAISE EXCEPTION 'authenticated pudo llamar a consume_quota';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- No puede borrar documentos de otro usuario (0 filas afectadas)…
DELETE FROM documents WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002';
DELETE FROM conversations WHERE id = 'bbbbbbbb-0000-4000-8000-0000000000c2';
DELETE FROM conversation_messages WHERE conversation_id = 'bbbbbbbb-0000-4000-8000-0000000000c2';
-- …ni insertar directamente (las escrituras van por el backend).
DO $$
BEGIN
  BEGIN
    INSERT INTO documents (user_id, title, file_path)
    VALUES ('11111111-1111-4111-8111-111111111111', 'x', 'x.pdf');
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en documents';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO consents (user_id, document, version)
    VALUES ('11111111-1111-4111-8111-111111111111', 'privacy', '2026-11-01');
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en consents';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO conversations (id, user_id)
    VALUES ('aaaaaaaa-0000-4000-8000-0000000000c9', '11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en conversations';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO conversation_messages (id, conversation_id, role, kind)
    VALUES ('aaaaaaaa-0000-4000-8000-0000000000d9', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'user', 'text');
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en conversation_messages';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO admin_audit (admin_user_id, admin_email, action, target)
    VALUES ('11111111-1111-4111-8111-111111111111', 'x@example.com', 'x', 'x');
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en admin_audit';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO waitlist (email, consent) VALUES ('x@example.com', true);
    RAISE EXCEPTION 'RLS: authenticated pudo insertar en waitlist';
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
  -- Sin permiso (CI) o sin filas visibles (Supabase concede SELECT por defecto): ambos valen.
  BEGIN
    IF (SELECT count(*) FROM consents) <> 0 THEN
      RAISE EXCEPTION 'RLS: anon pudo leer consents';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    IF (SELECT count(*) FROM conversations) <> 0 THEN
      RAISE EXCEPTION 'RLS: anon pudo leer conversations';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    IF (SELECT count(*) FROM conversation_messages) <> 0 THEN
      RAISE EXCEPTION 'RLS: anon pudo leer conversation_messages';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    IF (SELECT count(*) FROM admin_audit) <> 0 THEN
      RAISE EXCEPTION 'RLS: anon pudo leer admin_audit';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    IF (SELECT count(*) FROM waitlist) <> 0 THEN
      RAISE EXCEPTION 'RLS: anon pudo leer waitlist';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO waitlist (email, consent) VALUES ('anon@example.com', true);
    RAISE EXCEPTION 'RLS: anon pudo insertar en waitlist';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
DO $$
BEGIN
  IF (SELECT count(*) FROM documents) <> 2 THEN RAISE EXCEPTION 'RLS: un usuario borró un documento ajeno'; END IF;
  IF (SELECT count(*) FROM admin_audit) <> 1 THEN RAISE EXCEPTION 'RLS: se alteró la auditoría'; END IF;
  IF (SELECT count(*) FROM conversations) <> 2 THEN RAISE EXCEPTION 'RLS: un usuario borró una conversación ajena'; END IF;
  IF (SELECT count(*) FROM conversation_messages) <> 2 THEN RAISE EXCEPTION 'RLS: un usuario borró mensajes ajenos'; END IF;
  IF (SELECT count(*) FROM waitlist) <> 1 THEN RAISE EXCEPTION 'RLS: se alteró la lista de espera'; END IF;
END $$;

ROLLBACK;
\echo 'RLS OK: aislamiento por usuario verificado'
