-- Clasificación automática (fase 2). SQL propio que no genera `drizzle-kit generate`:
-- se aplica DESPUÉS de la migración con las columnas nuevas de `documents` y la tabla
-- `classification_corrections`.

-- Lo que ya tenía curso lo eligió el usuario: no aparece como pendiente de revisar.
UPDATE "documents" SET "classification_status" = 'confirmed'
WHERE "course_id" IS NOT NULL AND "classification_status" = 'none';--> statement-breakpoint

-- Correcciones: el usuario autenticado solo lee las suyas. Las escrituras las hace el backend.
ALTER TABLE "classification_corrections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Sin rol authenticated / auth.uid(): se omite la política de classification_corrections';
    RETURN;
  END IF;

  EXECUTE $p$
    CREATE POLICY "classification_corrections_select_own" ON "classification_corrections"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  GRANT SELECT ON "classification_corrections" TO authenticated;
END
$$;
