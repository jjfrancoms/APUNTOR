-- Lista de espera de menores: solo la toca el backend (dueño de la tabla).
-- RLS habilitada y sin políticas: authenticated y anon no ven ni escriben nada.
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Supabase concede privilegios por defecto a estos roles en public: se retiran.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "waitlist" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "waitlist" FROM anon;
  END IF;
END
$$;
