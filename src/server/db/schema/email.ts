// Only explicitly selected emails are retained; disconnecting removes access, not tasks.
import {
  pgTable,
  uuid,
  text,
  timestamp,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { documents } from "./documents";

export const gmailConnections = pgTable(
  "gmail_connections",
  {
    user_id: uuid("user_id").primaryKey(),
    connection_id: uuid("connection_id").notNull().defaultRandom(),
    email: text("email").notNull(),
    refresh_token_encrypted: text("refresh_token_encrypted").notNull(),
    connected_at: timestamp("connected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "gmail_connections_user_id_fkey",
      columns: [t.user_id],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const gmailOauthAttempts = pgTable(
  "gmail_oauth_attempts",
  {
    user_id: uuid("user_id").primaryKey(),
    state_hash: text("state_hash").notNull(),
    browser_hash: text("browser_hash").notNull(),
    verifier_encrypted: text("verifier_encrypted").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      name: "gmail_oauth_attempts_user_id_fkey",
      columns: [t.user_id],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
  ],
);

export const documentEmails = pgTable(
  "document_emails",
  {
    document_id: uuid("document_id").primaryKey(),
    user_id: uuid("user_id").notNull(),
    mailbox: text("mailbox").notNull(),
    provider_message_id: text("provider_message_id").notNull(),
    sender: text("sender").notNull(),
    subject: text("subject").notNull(),
    received_at: timestamp("received_at", { withTimezone: true }).notNull(),
    text_body: text("text_body").notNull(),
  },
  (t) => [
    foreignKey({
      name: "document_emails_document_id_fkey",
      columns: [t.document_id],
      foreignColumns: [documents.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "document_emails_user_id_fkey",
      columns: [t.user_id],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    unique("document_emails_user_id_mailbox_provider_message_id_key").on(
      t.user_id,
      t.mailbox,
      t.provider_message_id,
    ),
  ],
);
