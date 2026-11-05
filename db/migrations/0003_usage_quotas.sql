CREATE TABLE "usage_quotas" (
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period_start" date NOT NULL,
	"used" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_quotas_user_id_kind_period_start_pk" PRIMARY KEY("user_id","kind","period_start"),
	CONSTRAINT "usage_quotas_used_non_negative" CHECK ("usage_quotas"."used" >= 0),
	CONSTRAINT "usage_quotas_kind_valid" CHECK ("usage_quotas"."kind" IN ('questions', 'storage_bytes'))
);
