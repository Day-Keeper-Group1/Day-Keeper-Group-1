CREATE TABLE "document_emails" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"mailbox" text NOT NULL,
	"provider_message_id" text NOT NULL,
	"sender" text NOT NULL,
	"subject" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"text_body" text NOT NULL,
	CONSTRAINT "document_emails_user_id_mailbox_provider_message_id_key" UNIQUE("user_id","mailbox","provider_message_id")
);
--> statement-breakpoint
CREATE TABLE "gmail_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"connection_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_oauth_attempts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"state_hash" text NOT NULL,
	"browser_hash" text NOT NULL,
	"verifier_encrypted" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_emails" ADD CONSTRAINT "document_emails_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_emails" ADD CONSTRAINT "document_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_oauth_attempts" ADD CONSTRAINT "gmail_oauth_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;