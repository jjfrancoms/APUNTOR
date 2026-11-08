CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"consent" boolean NOT NULL,
	"source" text DEFAULT 'app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_lowercase" CHECK ("waitlist"."email" = lower("waitlist"."email")),
	CONSTRAINT "waitlist_source_valid" CHECK ("waitlist"."source" IN ('app', 'web'))
);
--> statement-breakpoint
ALTER TABLE "usage_quotas" DROP CONSTRAINT "usage_quotas_kind_valid";--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_email_idx" ON "waitlist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_kind_valid" CHECK ("usage_quotas"."kind" IN ('questions', 'storage_bytes', 'summaries'));