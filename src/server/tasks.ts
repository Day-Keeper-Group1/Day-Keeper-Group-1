/**
 * Task reads shared by the task endpoints.
 *
 * The database stores only the person's tick (`state`). Whether an open task
 * is upcoming or overdue is derived here, at read time, in that person's time
 * zone. Every query is scoped by user id: knowing another task's id must never
 * be enough to read it.
 *
 * KAN-93: an id that is not the shape of an id is a task nobody has, so each
 * function that is handed one answers null before asking the database, as the
 * letter functions do (src/lib/uuid.ts says why).
 */

import "server-only";

import {
  deriveTaskStatus,
  type TaskDetail,
  type TaskSummary,
} from "@/lib/contract/api";
import { isUuid } from "@/lib/uuid";
import { db } from "@/server/db";
import { findOwnedPageCount } from "@/server/db/queries/documents";
import {
  listOwnedFieldRowsInTaskOrder,
  listOwnedIdentifierRows,
} from "@/server/db/queries/readings";
import {
  completeOwnedTaskRows,
  findOwnedTaskRows,
  listOwnedTaskRows,
  reopenOwnedTaskRows,
  type TaskReminderRow,
} from "@/server/db/queries/tasks";
import { findOwnedVoiceByTask } from "@/server/db/queries/voice";
// A task's fields are the fields of the letter it came from, and the letter
// endpoints draw the same rows. Both word them in src/server/field-views.ts, so
// the two cannot spell a label differently or disagree about what a hedged
// value shows.
import { identifierViews, mapField } from "@/server/field-views";

/**
 * The order the task screen shows a letter's fields in. A key that is not
 * here comes after all of these, in the order of the keys themselves.
 */
export const TASK_DETAIL_FIELD_ORDER = [
  "document_type",
  "issuer",
  "action_required",
  "due_date",
  "due_time",
  "amount",
  "reference",
] as const;

function mapTaskRows(
  rows: TaskReminderRow[],
  timeZone: string,
  now: Date,
): TaskSummary[] {
  const tasks = new Map<string, TaskSummary>();

  for (const row of rows) {
    let task = tasks.get(row.id);
    if (!task) {
      task = {
        id: row.id,
        title: row.title,
        ...(row.documentId && { documentId: row.documentId }),
        issuer: row.issuer,
        dueDate: row.dueDate,
        ...(row.dueTime && { dueTime: row.dueTime }),
        status: deriveTaskStatus(row.state, row.dueDate, now, timeZone),
        reminders: [],
      };
      tasks.set(row.id, task);
    }

    if (row.reminderId) {
      if (!row.reminderLocalDate) {
        throw new Error(`Reminder ${row.reminderId} has no day.`);
      }
      task.reminders.push({
        id: row.reminderId,
        localDate: row.reminderLocalDate,
      });
    }
  }

  return [...tasks.values()];
}

/** Return every non-dismissed task this person owns, with every reminder. */
export async function listTasks(
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary[]> {
  const rows = await listOwnedTaskRows(db(), userId);

  return mapTaskRows(rows, timeZone, now);
}

/**
 * Return one owned task as a list row needs it, with every reminder.
 *
 * KAN-59: what confirming a letter answers with, so the screens the person
 * lands on can draw the new task without asking again.
 */
export async function getTaskSummary(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary | null> {
  if (!isUuid(taskId)) return null;

  const rows = await findOwnedTaskRows(db(), userId, taskId);
  const summary = mapTaskRows(rows, timeZone, now)[0] ?? null;
  if (!summary || summary.documentId) return summary;
  // A null document_id can mean a voice task or an orphaned photo task.
  // Only a linked, confirmed voice commitment makes the former visible.
  const voice = await findOwnedVoiceByTask(db(), userId, taskId);
  return voice?.transcript ? summary : null;
}

/** Return one owned task with the fields and page count of its letter. */
export async function getTask(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskDetail | null> {
  const summary = await getTaskSummary(taskId, userId, timeZone, now);
  if (!summary) return null;
  if (!summary.documentId) {
    const voice = await findOwnedVoiceByTask(db(), userId, taskId);
    if (!voice?.transcript) return null;
    return {
      ...summary,
      source: "voice",
      conversationId: voice.conversationId,
      transcript: voice.transcript,
      evidence: voice.evidence,
    };
  }

  const [pageCount, fields, identifiers] = await Promise.all([
    findOwnedPageCount(db(), userId, summary.documentId),
    listOwnedFieldRowsInTaskOrder(
      db(),
      userId,
      summary.documentId,
      TASK_DETAIL_FIELD_ORDER,
    ),
    listOwnedIdentifierRows(db(), userId, summary.documentId),
  ]);

  if (pageCount === null) return null;

  const views = fields.map(mapField);

  return {
    ...summary,
    source: "document",
    documentId: summary.documentId,
    fields: views,
    identifiers: identifierViews(identifiers, views),
    pageCount,
  };
}

/** Mark one owned, visible task completed and return it with unchanged reminders. */
export async function completeTask(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary | null> {
  if (!isUuid(taskId)) return null;

  const rows = await completeOwnedTaskRows(db(), userId, taskId);

  return mapTaskRows(rows, timeZone, now)[0] ?? null;
}

/** Reopen one owned, visible task and return it with unchanged reminders. */
export async function reopenTask(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary | null> {
  if (!isUuid(taskId)) return null;

  const rows = await reopenOwnedTaskRows(db(), userId, taskId);

  return mapTaskRows(rows, timeZone, now)[0] ?? null;
}
