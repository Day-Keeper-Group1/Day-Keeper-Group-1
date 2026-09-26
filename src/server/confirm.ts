// KAN-59: the moment a checked letter becomes a task with reminders.

/**
 * Confirming a letter.
 *
 * The person looked at what was read and said "Looks right, save it". That is
 * the only way anything reaches the calendar (src/lib/contract/api.ts), and
 * everything it causes happens here, in one transaction: the task, its
 * reminders, the letter marked confirmed, and a line in the audit log. A letter
 * that ended up confirmed with no task, or a task whose letter still waits to be
 * checked, are both states no screen knows how to draw.
 *
 * Server-only, like every other module that writes.
 */

import "server-only";

import { taskTitle, type ConfirmDocumentResponse } from "@/lib/contract/api";
import { todayInZone } from "@/lib/contract/dates";
import { NO_ACTION, actionWordOf } from "@/lib/contract/fields";
import { planReminders } from "@/lib/contract/reminders";
import { transaction } from "@/server/db";
import { getTaskSummary } from "@/server/tasks";

/**
 * A letter that exists and is hers, but is not waiting to be checked.
 *
 * `message` is shown to the person as it is (docs/api.md, "Confirm a letter"),
 * so it is a sentence about the letter rather than about the request.
 */
export class ConfirmRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmRefused";
  }
}

/** The same shape check as src/server/documents.ts, for the same reason. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why each status other than 'needs-review' cannot be confirmed, in her words. */
const REFUSALS: Record<string, string> = {
  confirmed: "This letter is already saved.",
  archived: "This letter is already saved.",
  processing: "This letter is still being read.",
  failed: "This letter could not be read, so there is nothing to save.",
};

type LetterRow = {
  status: string;
  issuer: string | null;
  document_type: string | null;
  due_date: string | null;
  due_time: string | null;
};

/**
 * Confirm one owned letter.
 *
 * Null when there is no such letter or it is somebody else's, so the handler
 * cannot tell the two apart. Throws ConfirmRefused when the letter is not
 * waiting to be checked.
 *
 * `now` is passed in rather than read so the reminders planned here are the
 * ones the review card promised: both ask planReminders() with the same
 * `today` (src/lib/contract/reminders.ts says why that matters).
 */
export async function confirmDocument(
  documentId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
): Promise<ConfirmDocumentResponse | null> {
  if (!UUID.test(documentId)) return null;

  const outcome = await transaction(async (client) => {
    // Locked, so two taps on the button (or two tabs) cannot both find the
    // letter waiting and make two tasks out of it. The second one waits here,
    // then finds it confirmed and is refused.
    const letter = await client.query<LetterRow>(
      `SELECT d.status,
              d.issuer,
              d.document_type,
              d.due_date,
              CASE WHEN d.due_time IS NULL
                   THEN NULL
                   ELSE to_char(d.due_time, 'HH24:MI')
              END AS due_time
         FROM documents d
        WHERE d.id = $1
          AND d.user_id = $2
          FOR UPDATE`,
      [documentId, userId],
    );
    const row = letter.rows[0];
    if (!row) return null;

    if (row.status !== "needs-review") {
      throw new ConfirmRefused(
        REFUSALS[row.status] ?? "This letter cannot be saved right now.",
      );
    }

    // The action the person saw on the card: confident values only, from the
    // one reading that succeeded (db/schema.sql). A hedged action was never
    // shown, so it is not used to name anything either.
    const action = await client.query<{ extracted_value: string | null }>(
      `SELECT f.extracted_value
         FROM extraction_runs e
         JOIN extracted_fields f ON f.extraction_run_id = e.id
        WHERE e.document_id = $1
          AND e.status = 'succeeded'
          AND f.field_key = 'action_required'
          AND f.status = 'confirmed'`,
      [documentId],
    );
    const actionText = action.rows[0]?.extracted_value ?? null;

    // A letter that asks for nothing is kept, and makes no task.
    const asksForNothing =
      actionText !== null && actionWordOf(actionText) === NO_ACTION;

    let taskId: string | null = null;
    let reminderCount = 0;

    if (!asksForNothing) {
      const task = await client.query<{ id: string }>(
        `INSERT INTO tasks (user_id, document_id, title, issuer, due_date, due_time)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          userId,
          documentId,
          taskTitle({
            action: actionText,
            issuer: row.issuer,
            documentType: row.document_type,
          }),
          row.issuer,
          row.due_date,
          row.due_time,
        ],
      );
      taskId = task.rows[0].id;

      // No date, no reminders: planReminders() needs a day to count back from,
      // and a task with no date sits on the list saying so instead.
      if (row.due_date) {
        const planned = planReminders(row.due_date, {
          today: todayInZone(timeZone, now),
        });
        for (const reminder of planned) {
          await client.query(
            `INSERT INTO reminders (task_id, remind_on) VALUES ($1, $2)`,
            [taskId, reminder.localDate],
          );
        }
        reminderCount = planned.length;
      }
    }

    await client.query(
      `UPDATE documents
          SET status = 'confirmed',
              confirmed_at = now(),
              updated_at = now()
        WHERE id = $1
          AND user_id = $2`,
      [documentId, userId],
    );

    // Metadata only: which letter, which task, how many reminders. Never a
    // value from the letter (db/schema.sql, "Audit").
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, detail)
       VALUES ($1, 'document.confirm', 'document', $2, $3)`,
      [
        userId,
        documentId,
        JSON.stringify({ taskId, reminders: reminderCount }),
      ],
    );

    return { taskId };
  });

  if (!outcome) return null;

  return {
    documentId,
    task: outcome.taskId
      ? await getTaskSummary(outcome.taskId, userId, timeZone, now)
      : null,
  };
}
