// KAN-92: the audit log, as a Drizzle table.

/**
 * Audit
 *
 * What happened to which record, and who did it. Signing in, confirming a
 * letter and deactivating an account are the events worth being able to
 * reconstruct after the fact, when the only other account of them is somebody's
 * memory.
 *
 * The table has nowhere to put the contents of a letter, and that is the point
 * rather than an omission. An operator can be given everything in here and
 * still never read a word of anyone's post.
 *
 * Script-safe: no `server-only`, because drizzle-kit, the scripts in db/ and
 * Vitest load the schema outside Next.js, where that module throws.
 */

import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id"),
    // 'user.sign_in', 'document.confirm', 'user.deactivate'
    action: text("action").notNull(),
    // 'document', 'user', 'task'
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    // Metadata only. Never field values, never letter text, never amounts.
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "audit_logs_actor_id_fkey",
      columns: [t.actorId],
      foreignColumns: [users.id],
    }).onDelete("set null"),
    // Newest first, written .desc().nullsFirst() for the reason given on
    // documents_user_uploaded_idx in ./documents.ts.
    index("audit_logs_created_idx").on(t.createdAt.desc().nullsFirst()),
    index("audit_logs_actor_idx").on(
      t.actorId,
      t.createdAt.desc().nullsFirst(),
    ),
  ],
);
