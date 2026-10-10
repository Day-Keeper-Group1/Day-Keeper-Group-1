/** Persisted voice transcripts and the clear commitments found in them. */

import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { ConversationTranscript } from "@/lib/contract/voice";
import { timeOfDay, updatedAt } from "./columns";
import { voiceCommitmentStatus, voiceConversationStatus } from "./enums";
import { tasks } from "./tasks";
import { users } from "./users";

/** One browser transcript. No audio bytes ever reach this table. */
export const voiceConversations = pgTable(
  "voice_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    clientSubmissionId: uuid("client_submission_id").notNull(),
    status: voiceConversationStatus("status").notNull().default("queued"),
    transcript: jsonb("transcript").$type<ConversationTranscript>(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    extractionStartedAt: timestamp("extraction_started_at", {
      withTimezone: true,
    }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "voice_conversations_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    unique("voice_conversations_user_submission_key").on(
      t.userId,
      t.clientSubmissionId,
    ),
    check(
      "voice_conversations_duration_range",
      sql`${t.durationMs} BETWEEN 1 AND 45000`,
    ),
    check(
      "voice_conversations_transcript_status",
      sql`(${t.status} = 'failed' AND ${t.transcript} IS NULL) OR (${t.status} <> 'failed' AND ${t.transcript} IS NOT NULL)`,
    ),
    index("voice_conversations_user_status_idx").on(
      t.userId,
      t.status,
      t.createdAt,
    ),
  ],
);

/** One clear commitment that a person can Confirm or Dismiss. */
export const voiceCommitments = pgTable(
  "voice_commitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    proposalKey: text("proposal_key").notNull(),
    title: text("title").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    dueTime: timeOfDay("due_time"),
    evidence: jsonb("evidence").$type<number[]>().notNull(),
    status: voiceCommitmentStatus("status").notNull().default("needs-review"),
    taskId: uuid("task_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "voice_commitments_conversation_id_fkey",
      columns: [t.conversationId],
      foreignColumns: [voiceConversations.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "voice_commitments_task_id_fkey",
      columns: [t.taskId],
      foreignColumns: [tasks.id],
    }),
    unique("voice_commitments_conversation_proposal_key").on(
      t.conversationId,
      t.proposalKey,
    ),
    unique("voice_commitments_task_id_key").on(t.taskId),
    check("voice_commitments_title_present", sql`btrim(${t.title}) <> ''`),
    check(
      "voice_commitments_time_requires_date",
      sql`${t.dueTime} IS NULL OR ${t.dueDate} IS NOT NULL`,
    ),
    check(
      "voice_commitments_review_state",
      sql`(${t.status} = 'confirmed' AND ${t.taskId} IS NOT NULL AND ${t.confirmedAt} IS NOT NULL AND ${t.dismissedAt} IS NULL) OR (${t.status} = 'dismissed' AND ${t.taskId} IS NULL AND ${t.confirmedAt} IS NULL AND ${t.dismissedAt} IS NOT NULL) OR (${t.status} = 'needs-review' AND ${t.taskId} IS NULL AND ${t.confirmedAt} IS NULL AND ${t.dismissedAt} IS NULL)`,
    ),
    index("voice_commitments_conversation_status_idx").on(
      t.conversationId,
      t.status,
    ),
  ],
);
