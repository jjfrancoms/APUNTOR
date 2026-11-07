-- Cuotas atómicas: una sola sentencia decide y suma, de modo que dos peticiones
-- simultáneas nunca superan el límite (sin lectura previa ni bloqueos de aplicación).
--
-- RLS: el usuario autenticado solo puede LEER su consumo. Las funciones no son
-- SECURITY DEFINER y se retira EXECUTE de PUBLIC: solo el backend las llama.

ALTER TABLE "usage_quotas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE FUNCTION consume_quota(
  p_user_id uuid,
  p_kind text,
  p_period_start date,
  p_amount bigint,
  p_limit bigint
) RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount debe ser positivo';
  END IF;
  IF p_amount > p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO usage_quotas AS q (user_id, kind, period_start, used)
  VALUES (p_user_id, p_kind, p_period_start, p_amount)
  ON CONFLICT (user_id, kind, period_start) DO UPDATE
    SET used = q.used + EXCLUDED.used, updated_at = now()
    WHERE q.used + EXCLUDED.used <= p_limit
  RETURNING true INTO v_ok;

  RETURN coalesce(v_ok, false);
END;
$$;--> statement-breakpoint

-- Devuelve lo consumido si la operación falla después de cobrarse (nunca baja de 0).
CREATE FUNCTION release_quota(
  p_user_id uuid,
  p_kind text,
  p_period_start date,
  p_amount bigint
) RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  UPDATE usage_quotas
     SET used = greatest(used - p_amount, 0), updated_at = now()
   WHERE user_id = p_user_id AND kind = p_kind AND period_start = p_period_start;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION consume_quota(uuid, text, date, bigint, bigint) FROM PUBLIC;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION release_quota(uuid, text, date, bigint) FROM PUBLIC;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR to_regprocedure('auth.uid()') IS NULL THEN
    RAISE NOTICE 'Sin rol authenticated / auth.uid(): se omite la política de usage_quotas';
    RETURN;
  END IF;

  EXECUTE $p$
    CREATE POLICY "usage_quotas_select_own" ON "usage_quotas"
      FOR SELECT TO authenticated
      USING ("user_id" = (SELECT auth.uid()))
  $p$;

  GRANT SELECT ON "usage_quotas" TO authenticated;
END
$$;
