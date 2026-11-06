-- Cursos: el usuario autenticado solo lee los suyos. Las escrituras las hace el backend.
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Sin rol authenticated / auth.uid(): se omite la política de courses';
    RETURN;
  END IF;

  EXECUTE $p$
    CREATE POLICY "courses_select_own" ON "courses"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  GRANT SELECT ON "courses" TO authenticated;
END
$$;
