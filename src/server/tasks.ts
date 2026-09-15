/**
 * Task reads shared by the task endpoints.
 *
 * The database stores only the person's tick (`state`). Whether an open task
 * is upcoming or overdue is derived here, at read time, in that person's time
 * zone. Every query is scoped by user id: knowing another task's id must never
 * be enough to read it.
 */

import "server-only";

import {
  deriveTaskStatus,
  type ReminderView,
  type TaskDetail,
  type TaskSummary,
} from "@/lib/contract/api";
import { query, queryOne } from "@/server/db";
// A task's fields are the fields of the letter it came from, and the letter
// endpoints draw the same rows. Both word them in src/server/field-views.ts, so
// the two cannot spell a label differently or disagree about what a hedged
// value shows.
import {
  identifierViews,
  mapField,
  type ExtractedFieldRow,
  type ExtractedIdentifierRow,
} from "@/server/field-views";

type TaskListRow = {
  id: string;
  title: string;
  document_id: string | null;
  issuer: string | null;
  due_date: string | null;
  due_time: string | null;
  state: "open" | "completed" | "dismissed";
  reminder_id: string | null;
  scheduled_for: Date | null;
  reminder_local_date: string | null;
  reminder_local_time: string | null;
  reminder_channel: ReminderView["channel"] | null;
  reminder_status: ReminderView["status"] | null;
};

function mapTaskRows(
  rows: TaskListRow[],
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
        ...(row.document_id && { documentId: row.document_id }),
        issuer: row.issuer,
        dueDate: row.due_date,
        ...(row.due_time && { dueTime: row.due_time }),
        status: deriveTaskStatus(row.state, row.due_date, now, timeZone),
        reminders: [],
      };
      tasks.set(row.id, task);
    }

    if (row.reminder_id) {
      if (
        !row.scheduled_for ||
        !row.reminder_local_date ||
        !row.reminder_local_time ||
        !row.reminder_channel ||
        !row.reminder_status
      ) {
        throw new Error(`Reminder ${row.reminder_id} is incomplete.`);
      }

      task.reminders.push({
        id: row.reminder_id,
        scheduledFor: row.scheduled_for.toISOString(),
        localDate: row.reminder_local_date,
        localTime: row.reminder_local_time,
        channel: row.reminder_channel,
        status: row.reminder_status,
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
  const rows = await query<TaskListRow>(
    `SELECT t.id,
            t.title,
            t.document_id,
            t.issuer,
            t.due_date,
            CASE WHEN t.due_time IS NULL
                 THEN NULL
                 ELSE to_char(t.due_time, 'HH24:MI')
            END AS due_time,
            t.state,
            r.id AS reminder_id,
            r.scheduled_for,
            to_char(r.scheduled_for AT TIME ZONE $2, 'YYYY-MM-DD')
              AS reminder_local_date,
            to_char(r.scheduled_for AT TIME ZONE $2, 'HH24:MI')
              AS reminder_local_time,
            r.channel AS reminder_channel,
            r.status AS reminder_status
       FROM tasks t
       LEFT JOIN reminders r ON r.task_id = t.id
      WHERE t.user_id = $1
        AND t.state <> 'dismissed'
      ORDER BY t.due_date ASC NULLS LAST,
               t.created_at ASC,
               t.id ASC,
               r.scheduled_for ASC,
               r.id ASC`,
    [userId, timeZone],
  );

  return mapTaskRows(rows, timeZone, now);
}

/**
 * Return one owned task as a list row needs it, with every reminder.
 *
 * KAN-59: what confirming a letter answers with, so the calendar the person
 * lands on can draw the new task without asking again.
 */
export async function getTaskSummary(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary | null> {
  const rows = await query<TaskListRow>(
    `SELECT t.id,
            t.title,
            t.document_id,
            t.issuer,
            t.due_date,
            CASE WHEN t.due_time IS NULL
                 THEN NULL
                 ELSE to_char(t.due_time, 'HH24:MI')
            END AS due_time,
            t.state,
            r.id AS reminder_id,
            r.scheduled_for,
            to_char(r.scheduled_for AT TIME ZONE $3, 'YYYY-MM-DD')
              AS reminder_local_date,
            to_char(r.scheduled_for AT TIME ZONE $3, 'HH24:MI')
              AS reminder_local_time,
            r.channel AS reminder_channel,
            r.status AS reminder_status
       FROM tasks t
       LEFT JOIN reminders r ON r.task_id = t.id
      WHERE t.id = $1
        AND t.user_id = $2
        AND t.document_id IS NOT NULL
        AND t.state <> 'dismissed'
      ORDER BY r.scheduled_for ASC, r.id ASC`,
    [taskId, userId, timeZone],
  );

  return mapTaskRows(rows, timeZone, now)[0] ?? null;
}

/** Return one owned task with the fields and page count of its letter. */
export async function getTask(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskDetail | null> {
  const summary = await getTaskSummary(taskId, userId, timeZone, now);
  if (!summary?.documentId) return null;

  const [page, fields, identifiers] = await Promise.all([
    queryOne<{ page_count: number }>(
      `SELECT count(p.id)::integer AS page_count
         FROM documents d
         LEFT JOIN document_pages p ON p.document_id = d.id
        WHERE d.id = $1
          AND d.user_id = $2
        GROUP BY d.id`,
      [summary.documentId, userId],
    ),
    query<ExtractedFieldRow>(
      `SELECT f.field_key, f.extracted_value, f.status
         FROM documents d
         JOIN extraction_runs e ON e.document_id = d.id
         JOIN extracted_fields f ON f.extraction_run_id = e.id
        WHERE d.id = $1
          AND d.user_id = $2
          AND e.status = 'succeeded'
        ORDER BY CASE f.field_key
                   WHEN 'document_type' THEN 1
                   WHEN 'issuer' THEN 2
                   WHEN 'action_required' THEN 3
                   WHEN 'due_date' THEN 4
                   WHEN 'due_time' THEN 5
                   WHEN 'amount' THEN 6
                   WHEN 'reference' THEN 7
                   ELSE 8
                 END,
                 f.field_key`,
      [summary.documentId, userId],
    ),
    query<ExtractedIdentifierRow>(
      `SELECT i.label, i.value, i.status
         FROM documents d
         JOIN extraction_runs e ON e.document_id = d.id
         JOIN extracted_identifiers i ON i.extraction_run_id = e.id
        WHERE d.id = $1
          AND d.user_id = $2
          AND e.status = 'succeeded'
        ORDER BY i.position`,
      [summary.documentId, userId],
    ),
  ]);

  if (!page) return null;

  const views = fields.map(mapField);

  return {
    ...summary,
    documentId: summary.documentId,
    fields: views,
    identifiers: identifierViews(identifiers, views),
    pageCount: page.page_count,
  };
}

/** Mark one owned, visible task completed and return it with unchanged reminders. */
export async function completeTask(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary | null> {
  const rows = await query<TaskListRow>(
    `WITH completed_task AS (
       UPDATE tasks
          SET state = 'completed',
              completed_at = COALESCE(completed_at, now()),
              updated_at = now()
        WHERE id = $1
          AND user_id = $2
          AND state <> 'dismissed'
      RETURNING id, title, document_id, issuer, due_date, due_time, state
     )
     SELECT t.id,
            t.title,
            t.document_id,
            t.issuer,
            t.due_date,
            CASE WHEN t.due_time IS NULL
                 THEN NULL
                 ELSE to_char(t.due_time, 'HH24:MI')
            END AS due_time,
            t.state,
            r.id AS reminder_id,
            r.scheduled_for,
            to_char(r.scheduled_for AT TIME ZONE $3, 'YYYY-MM-DD')
              AS reminder_local_date,
            to_char(r.scheduled_for AT TIME ZONE $3, 'HH24:MI')
              AS reminder_local_time,
            r.channel AS reminder_channel,
            r.status AS reminder_status
       FROM completed_task t
       LEFT JOIN reminders r ON r.task_id = t.id
      ORDER BY r.scheduled_for ASC, r.id ASC`,
    [taskId, userId, timeZone],
  );

  return mapTaskRows(rows, timeZone, now)[0] ?? null;
}

/** Reopen one owned, visible task and return it with unchanged reminders. */
export async function reopenTask(
  taskId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<TaskSummary | null> {
  const rows = await query<TaskListRow>(
    `WITH reopened_task AS (
       UPDATE tasks
          SET state = 'open',
              completed_at = NULL,
              updated_at = now()
        WHERE id = $1
          AND user_id = $2
          AND state <> 'dismissed'
      RETURNING id, title, document_id, issuer, due_date, due_time, state
     )
     SELECT t.id,
            t.title,
            t.document_id,
            t.issuer,
            t.due_date,
            CASE WHEN t.due_time IS NULL
                 THEN NULL
                 ELSE to_char(t.due_time, 'HH24:MI')
            END AS due_time,
            t.state,
            r.id AS reminder_id,
            r.scheduled_for,
            to_char(r.scheduled_for AT TIME ZONE $3, 'YYYY-MM-DD')
              AS reminder_local_date,
            to_char(r.scheduled_for AT TIME ZONE $3, 'HH24:MI')
              AS reminder_local_time,
            r.channel AS reminder_channel,
            r.status AS reminder_status
       FROM reopened_task t
       LEFT JOIN reminders r ON r.task_id = t.id
      ORDER BY r.scheduled_for ASC, r.id ASC`,
    [taskId, userId, timeZone],
  );

  return mapTaskRows(rows, timeZone, now)[0] ?? null;
}
