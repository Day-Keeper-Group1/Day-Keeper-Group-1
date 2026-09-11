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
  type TaskSummary,
} from "@/lib/contract/api";
import { query } from "@/server/db";

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
