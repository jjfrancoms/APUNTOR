-- Auditoría del panel de administrador: solo la toca el backend (dueño de la tabla).
-- RLS habilitada y sin políticas: authenticated y anon no ven ni escriben nada.
ALTER TABLE "admin_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Supabase concede privilegios por defecto a estos roles en public: se retiran por si acaso.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "admin_audit" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "admin_audit" FROM anon;
  END IF;
END
$$;
