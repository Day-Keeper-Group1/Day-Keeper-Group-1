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
import { isUuid } from "@/lib/uuid";
import { db } from "@/server/db";
import { insertAuditLog } from "@/server/db/queries/audit";
import {
  lockOwnedDocument,
  markOwnedDocumentConfirmed,
} from "@/server/db/queries/documents";
import { findConfirmedAction } from "@/server/db/queries/readings";
import { insertReminders, insertTask } from "@/server/db/queries/tasks";
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

/** Why each status other than 'needs-review' cannot be confirmed, in her words. */
const REFUSALS: Record<string, string> = {
  confirmed: "This letter is already saved.",
  archived: "This letter is already saved.",
  processing: "This letter is still being read.",
  failed: "This letter could not be read, so there is nothing to save.",
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
  if (!isUuid(documentId)) return null;

  // Every statement in here is sent on `tx`. One sent on db() would run outside
  // the transaction, and where the pool holds a single connection it would
  // wait for the very connection this transaction is holding.
  const outcome = await db().transaction(async (tx) => {
    // Locked, so two taps on the button (or two tabs) cannot both find the
    // letter waiting and make two tasks out of it. The second one waits here,
    // then finds it confirmed and is refused.
    const letter = await lockOwnedDocument(tx, userId, documentId);
    if (!letter) return null;

    if (letter.status !== "needs-review") {
      throw new ConfirmRefused(
        REFUSALS[letter.status] ?? "This letter cannot be saved right now.",
      );
    }

    // The action the person saw on the card: confident values only, from the
    // one reading that succeeded (db/schema.sql). A hedged action was never
    // shown, so it is not used to name anything either.
    const actionText = await findConfirmedAction(tx, documentId);

    // A letter that asks for nothing is kept, and makes no task.
    const asksForNothing =
      actionText !== null && actionWordOf(actionText) === NO_ACTION;

    let taskId: string | null = null;
    let reminderCount = 0;

    if (!asksForNothing) {
      taskId = await insertTask(tx, {
        userId,
        documentId,
        title: taskTitle({
          action: actionText,
          issuer: letter.issuer,
          documentType: letter.documentType,
        }),
        issuer: letter.issuer,
        dueDate: letter.dueDate,
        dueTime: letter.dueTime,
      });

      // No date, no reminders: planReminders() needs a day to count back from,
      // and a task with no date sits on the list saying so instead.
      if (letter.dueDate) {
        const planned = planReminders(letter.dueDate, {
          today: todayInZone(timeZone, now),
        });
        await insertReminders(
          tx,
          taskId,
          planned.map((reminder) => reminder.localDate),
        );
        reminderCount = planned.length;
      }
    }

    await markOwnedDocumentConfirmed(tx, userId, documentId);

    // Metadata only: which letter, which task, how many reminders. Never a
    // value from the letter (db/schema.sql, "Audit").
    await insertAuditLog(tx, {
      actorId: userId,
      action: "document.confirm",
      targetType: "document",
      targetId: documentId,
      detail: { taskId, reminders: reminderCount },
    });

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
