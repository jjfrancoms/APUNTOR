-- Cuota diaria de resúmenes generados (`summaries`), para convertir en migración tras el merge.
--
-- `db/schema.ts` ya admite el tipo nuevo, así que `drizzle-kit generate` producirá este mismo
-- cambio de la restricción: si lo hace, este archivo sobra. Es idempotente, por lo que aplicarlo
-- además no hace daño.
--
-- ORDEN DE DESPLIEGUE: aplicar ANTES de publicar la API. Con la restricción vieja,
-- consume_quota('summaries') falla y todo resumen sin guardar responde 502 CHAT_FAILED.
--
-- consume_quota y release_quota reciben el tipo como texto: no necesitan cambios.

ALTER TABLE "usage_quotas" DROP CONSTRAINT IF EXISTS "usage_quotas_kind_valid";

ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_kind_valid"
  CHECK ("usage_quotas"."kind" IN ('questions', 'storage_bytes', 'summaries'));
