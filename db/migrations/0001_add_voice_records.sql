CREATE TYPE "public"."voice_commitment_status" AS ENUM('needs-review', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."voice_conversation_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "voice_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"proposal_key" text NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"due_time" time,
	"evidence" jsonb NOT NULL,
	"status" "voice_commitment_status" DEFAULT 'needs-review' NOT NULL,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_commitments_conversation_proposal_key" UNIQUE("conversation_id","proposal_key"),
	CONSTRAINT "voice_commitments_task_id_key" UNIQUE("task_id"),
	CONSTRAINT "voice_commitments_title_present" CHECK (btrim("voice_commitments"."title") <> ''),
	CONSTRAINT "voice_commitments_time_requires_date" CHECK ("voice_commitments"."due_time" IS NULL OR "voice_commitments"."due_date" IS NOT NULL),
	CONSTRAINT "voice_commitments_review_state" CHECK (("voice_commitments"."status" = 'confirmed' AND "voice_commitments"."task_id" IS NOT NULL AND "voice_commitments"."confirmed_at" IS NOT NULL AND "voice_commitments"."dismissed_at" IS NULL) OR ("voice_commitments"."status" = 'dismissed' AND "voice_commitments"."task_id" IS NULL AND "voice_commitments"."confirmed_at" IS NULL AND "voice_commitments"."dismissed_at" IS NOT NULL) OR ("voice_commitments"."status" = 'needs-review' AND "voice_commitments"."task_id" IS NULL AND "voice_commitments"."confirmed_at" IS NULL AND "voice_commitments"."dismissed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "voice_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_submission_id" uuid NOT NULL,
	"status" "voice_conversation_status" DEFAULT 'queued' NOT NULL,
	"transcript" jsonb,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"extraction_started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"failure_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_conversations_user_submission_key" UNIQUE("user_id","client_submission_id"),
	CONSTRAINT "voice_conversations_duration_range" CHECK ("voice_conversations"."duration_ms" BETWEEN 1 AND 45000),
	CONSTRAINT "voice_conversations_transcript_status" CHECK (("voice_conversations"."status" = 'failed' AND "voice_conversations"."transcript" IS NULL) OR ("voice_conversations"."status" <> 'failed' AND "voice_conversations"."transcript" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "voice_commitments" ADD CONSTRAINT "voice_commitments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."voice_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_commitments" ADD CONSTRAINT "voice_commitments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_conversations" ADD CONSTRAINT "voice_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_commitments_conversation_status_idx" ON "voice_commitments" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "voice_conversations_user_status_idx" ON "voice_conversations" USING btree ("user_id","status","created_at");