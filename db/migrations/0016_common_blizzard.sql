CREATE TABLE "classification_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "conversation_messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_messages_conversation_id_id_pk" PRIMARY KEY("conversation_id","id"),
	CONSTRAINT "conversation_messages_role_valid" CHECK ("conversation_messages"."role" IN ('user', 'mascot')),
	CONSTRAINT "conversation_messages_kind_valid" CHECK ("conversation_messages"."kind" IN ('text', 'answer', 'notFound', 'external', 'error', 'limit', 'smallTalk', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"course" text DEFAULT '' NOT NULL,
	"scope_document_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"chunk_id" uuid NOT NULL,
	"page" integer NOT NULL,
	CONSTRAINT "study_items_page_positive" CHECK ("study_items"."page" >= 1)
);
--> statement-breakpoint
CREATE TABLE "study_reviews" (
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"box" integer DEFAULT 0 NOT NULL,
	"due_date" date NOT NULL,
	"last_result" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_reviews_user_id_item_id_pk" PRIMARY KEY("user_id","item_id"),
	CONSTRAINT "study_reviews_box_valid" CHECK ("study_reviews"."box" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "study_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"topic_id" uuid,
	"kind" text NOT NULL,
	"last_score" integer,
	"last_total" integer,
	"last_played_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_sets_kind_valid" CHECK ("study_sets"."kind" IN ('quiz', 'cards'))
);
--> statement-breakpoint
ALTER TABLE "usage_quotas" DROP CONSTRAINT "usage_quotas_kind_valid";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "suggested_course_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "suggested_course_title" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "suggestion_confidence" double precision;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "suggestion_reason" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "classification_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "classification_corrections" ADD CONSTRAINT "classification_corrections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_corrections" ADD CONSTRAINT "classification_corrections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_set_id_study_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."study_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_reviews" ADD CONSTRAINT "study_reviews_item_id_study_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."study_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sets" ADD CONSTRAINT "study_sets_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sets" ADD CONSTRAINT "study_sets_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classification_corrections_document_idx" ON "classification_corrections" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "classification_corrections_user_created_idx" ON "classification_corrections" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_order_idx" ON "conversation_messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "conversations" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "study_items_set_position_idx" ON "study_items" USING btree ("set_id","position");--> statement-breakpoint
CREATE INDEX "study_items_chunk_id_idx" ON "study_items" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "study_reviews_user_due_idx" ON "study_reviews" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "study_reviews_item_id_idx" ON "study_reviews" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "study_sets_user_id_idx" ON "study_sets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "study_sets_document_id_idx" ON "study_sets" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "study_sets_topic_id_idx" ON "study_sets" USING btree ("topic_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_suggested_course_id_courses_id_fk" FOREIGN KEY ("suggested_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_classification_status_valid" CHECK ("documents"."classification_status" IN ('none', 'suggested', 'confirmed', 'dismissed'));--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_suggestion_confidence_range" CHECK ("documents"."suggestion_confidence" IS NULL OR "documents"."suggestion_confidence" BETWEEN 0 AND 1);--> statement-breakpoint
ALTER TABLE "usage_quotas" ADD CONSTRAINT "usage_quotas_kind_valid" CHECK ("usage_quotas"."kind" IN ('questions', 'storage_bytes', 'summaries', 'study_generations'));