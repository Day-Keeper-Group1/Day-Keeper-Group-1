// KAN-92: tasks and the days they are marked as reminders, as Drizzle tables.

/**
 * Tasks and reminders
 *
 * Script-safe: no `server-only`, because drizzle-kit, the scripts in db/ and
 * Vitest load the schema outside Next.js, where that module throws.
 */

import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { timeOfDay, updatedAt } from "./columns";
import { documents } from "./documents";
import { taskState } from "./enums";
import { users } from "./users";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    // Every task points back at the letter it came from. This is the link that
    // makes the whole product trustworthy: weeks later the person can ask
    // "what said so?" and be shown the photograph. Nullable only because a
    // person may one day add a task by hand.
    documentId: uuid("document_id"),
    title: text("title").notNull(),
    issuer: text("issuer"),
    dueDate: date("due_date", { mode: "string" }),
    // Mirrors documents.due_time: set for an appointment, null for a deadline.
    dueTime: timeOfDay("due_time"),
    // The one fact about a task that a person controls. Ticked is completed,
    // not ticked is open, and everything else a screen says (upcoming,
    // overdue, where the row sorts) is arithmetic done while drawing. Ticking
    // is never locked in either direction: untick a task whose date has passed
    // and it is overdue again by arithmetic, not by a transition anything had
    // to run and could get wrong.
    state: taskState("state").notNull().default("open"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "tasks_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tasks_document_id_fkey",
      columns: [t.documentId],
      foreignColumns: [documents.id],
    }).onDelete("set null"),
    check("tasks_title_present", sql`btrim(${t.title}) <> ''`),
    check(
      "tasks_completed_has_timestamp",
      sql`(${t.state} = 'completed') = (${t.completedAt} IS NOT NULL)`,
    ),
    index("tasks_user_state_due_idx").on(t.userId, t.state, t.dueDate),
    index("tasks_document_idx")
      .on(t.documentId)
      .where(sql`${t.documentId} IS NOT NULL`),
  ],
);

/**
 * A reminder is a day, not a message. KAN-62: on each of the days seven, three
 * and one before a task is due, Home marks that task's row as a reminder, and
 * that is all a reminder does. Nothing is sent: there is no notification, no
 * email, and nothing running in the background, so there is nothing to record
 * about a reminder beyond the day it falls on.
 *
 * Rows rather than a rule worked out at read time, because the days are
 * planned once, on the day the letter is confirmed, and one that would fall on
 * that day or before it is never planned: she has just looked at the letter.
 * Only the confirm day knows that, so it is written down then. Ticking a task
 * writes nothing here; Home simply does not mark a ticked task. When they are
 * planned: src/lib/contract/reminders.ts.
 */
export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull(),
    // A day on her calendar, in her zone, not an instant.
    remindOn: date("remind_on", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "reminders_task_id_fkey",
      columns: [t.taskId],
      foreignColumns: [tasks.id],
    }).onDelete("cascade"),
    unique("reminders_task_id_remind_on_key").on(t.taskId, t.remindOn),
  ],
);
