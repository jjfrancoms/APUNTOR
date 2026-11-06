CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_title_not_empty" CHECK (length(trim("courses"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "course_id" uuid;--> statement-breakpoint
CREATE INDEX "courses_user_id_idx" ON "courses" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_course_id_idx" ON "documents" USING btree ("course_id");