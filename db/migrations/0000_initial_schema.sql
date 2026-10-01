CREATE TYPE "public"."document_status" AS ENUM('processing', 'needs-review', 'confirmed', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."field_status" AS ENUM('confirmed', 'uncertain', 'unreadable');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_state" AS ENUM('open', 'completed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'platform_operator', 'org_admin', 'org_worker');--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	CONSTRAINT "sessions_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_canonical" text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"timezone" text DEFAULT 'Australia/Melbourne' NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_present" CHECK (btrim("users"."email") <> ''),
	CONSTRAINT "users_display_name_present" CHECK (btrim("users"."display_name") <> ''),
	CONSTRAINT "users_timezone_present" CHECK (btrim("users"."timezone") <> '')
);
--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_pages_unique_page" UNIQUE("document_id","page_number"),
	CONSTRAINT "document_pages_page_number_positive" CHECK ("document_pages"."page_number" >= 1),
	CONSTRAINT "document_pages_byte_size_positive" CHECK ("document_pages"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "document_status" DEFAULT 'processing' NOT NULL,
	"issuer" text,
	"document_type" text,
	"due_date" date,
	"due_time" time,
	"amount_text" text,
	"reference" text,
	"open_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_confirmed_has_timestamp" CHECK ("documents"."status" <> 'confirmed' OR "documents"."confirmed_at" IS NOT NULL),
	CONSTRAINT "documents_archived_has_timestamp" CHECK (("documents"."status" = 'archived') = ("documents"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "extracted_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"extracted_value" text,
	"status" "field_status" NOT NULL,
	"confidence" numeric(4, 3),
	CONSTRAINT "extracted_fields_unique_key" UNIQUE("extraction_run_id","field_key"),
	CONSTRAINT "extracted_fields_confidence_range" CHECK ("extracted_fields"."confidence" IS NULL OR ("extracted_fields"."confidence" >= 0 AND "extracted_fields"."confidence" <= 1))
);
--> statement-breakpoint
CREATE TABLE "extracted_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"status" "field_status" NOT NULL,
	CONSTRAINT "extracted_identifiers_unique_position" UNIQUE("extraction_run_id","position"),
	CONSTRAINT "extracted_identifiers_status" CHECK ("extracted_identifiers"."status" IN ('confirmed', 'uncertain'))
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"contract_version" text,
	"failure_detail" text,
	"raw_response" jsonb,
	"judged" boolean DEFAULT false NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(12, 8),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	CONSTRAINT "extraction_runs_failed_has_detail" CHECK (("extraction_runs"."status" = 'failed') = ("extraction_runs"."failure_detail" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "model_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_run_id" uuid NOT NULL,
	"role" text NOT NULL,
	"slot" integer NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"model" text,
	"effort" text,
	"raw_response" jsonb,
	"failure_detail" text,
	"input_tokens" integer,
	"cached_tokens" integer,
	"reasoning_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(12, 8),
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_calls_role" CHECK ("model_calls"."role" IN ('reader', 'judge')),
	CONSTRAINT "model_calls_status" CHECK ("model_calls"."status" IN ('succeeded', 'failed')),
	CONSTRAINT "model_calls_failed_has_detail" CHECK (("model_calls"."status" = 'failed') = ("model_calls"."failure_detail" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"remind_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_task_id_remind_on_key" UNIQUE("task_id","remind_on")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid,
	"title" text NOT NULL,
	"issuer" text,
	"due_date" date,
	"due_time" time,
	"state" "task_state" DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_title_present" CHECK (btrim("tasks"."title") <> ''),
	CONSTRAINT "tasks_completed_has_timestamp" CHECK (("tasks"."state" = 'completed') = ("tasks"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_identifiers" ADD CONSTRAINT "extracted_identifiers_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_extraction_run_id_fkey" FOREIGN KEY ("extraction_run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_canonical_key" ON "users" USING btree ("email_canonical");--> statement-breakpoint
CREATE INDEX "documents_user_uploaded_idx" ON "documents" USING btree ("user_id","uploaded_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "documents_user_status_idx" ON "documents" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "documents_user_due_idx" ON "documents" USING btree ("user_id","due_date") WHERE "documents"."due_date" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "extracted_fields_run_idx" ON "extracted_fields" USING btree ("extraction_run_id");--> statement-breakpoint
CREATE INDEX "extracted_identifiers_run_idx" ON "extracted_identifiers" USING btree ("extraction_run_id");--> statement-breakpoint
CREATE INDEX "extraction_runs_status_idx" ON "extraction_runs" USING btree ("status") WHERE "extraction_runs"."status" IN ('queued', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_runs_one_success_per_document" ON "extraction_runs" USING btree ("document_id") WHERE "extraction_runs"."status" = 'succeeded';--> statement-breakpoint
CREATE UNIQUE INDEX "extraction_runs_one_under_way_per_document" ON "extraction_runs" USING btree ("document_id") WHERE "extraction_runs"."status" IN ('queued', 'processing');--> statement-breakpoint
CREATE INDEX "model_calls_run_idx" ON "model_calls" USING btree ("extraction_run_id");--> statement-breakpoint
CREATE INDEX "tasks_user_state_due_idx" ON "tasks" USING btree ("user_id","state","due_date");--> statement-breakpoint
CREATE INDEX "tasks_document_idx" ON "tasks" USING btree ("document_id") WHERE "tasks"."document_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE VIEW "public"."document_reading_totals" AS (select "d"."id" as "document_id", "d"."issuer", "d"."status", "d"."uploaded_at", count("r"."id")::integer as "rounds", (count(*) FILTER (WHERE "r"."judged"))::integer as "judged_rounds", sum("r"."input_tokens")::integer as "input_tokens", sum("r"."output_tokens")::integer as "output_tokens", sum("r"."estimated_cost_usd") as "estimated_cost_usd", CASE WHEN bool_and("r"."finished_at" IS NOT NULL) THEN (extract(epoch FROM max("r"."finished_at") - min("r"."started_at")) * 1000)::integer END as "duration_ms" from "documents" "d" inner join "extraction_runs" "r" on "r"."document_id" = "d"."id" group by "d"."id");