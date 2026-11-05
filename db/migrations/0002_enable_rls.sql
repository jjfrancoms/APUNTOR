-- Row Level Security: cada usuario solo ve sus propios documentos, chunks y temas.
--
-- Modelo de acceso (mínimo privilegio):
-- * Las escrituras (registrar documento, chunks, temas, estados) las hace SOLO el
--   backend/worker conectado como dueño de las tablas o service_role, que omiten RLS.
-- * El rol `authenticated` de Supabase puede LEER lo suyo y BORRAR sus documentos
--   (el borrado arrastra chunks y temas por ON DELETE CASCADE).
-- * `anon` no tiene ninguna política: acceso denegado.
--
-- RLS se habilita siempre. Las políticas solo se crean si existen el rol
-- `authenticated` y la función `auth.uid()` (Supabase); así la migración también
-- aplica sobre un Postgres sin Supabase (CI, desarrollo local).

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "topics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Sin rol authenticated / auth.uid(): se omiten las políticas RLS';
    RETURN;
  END IF;

  -- `(select auth.uid())` se evalúa una vez por consulta, no por fila.
  EXECUTE $p$
    CREATE POLICY "documents_select_own" ON "documents"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  EXECUTE $p$
    CREATE POLICY "documents_delete_own" ON "documents"
      FOR DELETE TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  EXECUTE $p$
    CREATE POLICY "document_chunks_select_own" ON "document_chunks"
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "documents" d
        WHERE d."id" = "document_chunks"."document_id"
          AND d."user_id" = (SELECT auth.uid())
      ))
  $p$;

  EXECUTE $p$
    CREATE POLICY "topics_select_own" ON "topics"
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "documents" d
        WHERE d."id" = "topics"."document_id"
          AND d."user_id" = (SELECT auth.uid())
      ))
  $p$;

  GRANT SELECT, DELETE ON "documents" TO authenticated;
  GRANT SELECT ON "document_chunks", "topics" TO authenticated;
END
$$;
