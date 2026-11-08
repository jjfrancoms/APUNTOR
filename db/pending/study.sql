-- Fase 3 (quizzes, tarjetas y repaso). SQL a mano que drizzle-kit no genera: se aplica tras la
-- migración generada desde db/schema.ts (crea study_sets, study_items y study_reviews).

-- Cuota diaria de generaciones. Idempotente: drizzle-kit también genera el cambio del CHECK.
ALTER TABLE "usage_quotas" DROP CONSTRAINT IF EXISTS "usage_quotas_kind_valid";--> statement-breakpoint
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_kind_valid"
  CHECK ("kind" IN ('questions', 'storage_bytes', 'summaries', 'study_generations'));--> statement-breakpoint

-- El usuario autenticado solo lee lo suyo; las escrituras las hace el backend.
ALTER TABLE "study_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Sin rol authenticated / auth.uid(): se omiten las políticas de estudio';
    RETURN;
  END IF;

  EXECUTE $p$
    CREATE POLICY "study_sets_select_own" ON "study_sets"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  EXECUTE $p$
    CREATE POLICY "study_items_select_own" ON "study_items"
      FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM "study_sets" s
        WHERE s."id" = "set_id" AND s."user_id" = (SELECT auth.uid())
      ))
  $p$;

  EXECUTE $p$
    CREATE POLICY "study_reviews_select_own" ON "study_reviews"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  GRANT SELECT ON "study_sets", "study_items", "study_reviews" TO authenticated;
END
$$;
