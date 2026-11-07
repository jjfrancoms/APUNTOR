CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consents_document_valid" CHECK ("consents"."document" IN ('terms', 'privacy'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "consents_user_document_version_idx" ON "consents" USING btree ("user_id","document","version");