/** Confirming a clear commitment creates one shared task and its reminders. */
import "server-only";

import { todayInZone } from "@/lib/contract/dates";
import { planReminders } from "@/lib/contract/reminders";
import { isUuid } from "@/lib/uuid";
import { db } from "@/server/db";
import { insertAuditLog } from "@/server/db/queries/audit";
import { insertReminders, insertTask } from "@/server/db/queries/tasks";
import {
  lockOwnedVoiceCommitment,
  markOwnedVoiceCommitmentConfirmed,
  markOwnedVoiceCommitmentDismissed,
} from "@/server/db/queries/voice";
import { getTaskSummary } from "@/server/tasks";

export class VoiceReviewConflict extends Error {
  constructor() {
    super("This commitment has already been checked.");
    this.name = "VoiceReviewConflict";
  }
}

export async function confirmVoiceCommitment(
  conversationId: string,
  commitmentId: string,
  userId: string,
  timeZone: string,
  now: Date = new Date(),
) {
  if (!isUuid(conversationId) || !isUuid(commitmentId)) return null;

  const taskId = await db().transaction(async (tx) => {
    const commitment = await lockOwnedVoiceCommitment(
      tx,
      userId,
      conversationId,
      commitmentId,
    );
    if (!commitment) return null;
    if (commitment.status !== "needs-review") throw new VoiceReviewConflict();

    const newTaskId = await insertTask(tx, {
      userId,
      documentId: null,
      title: commitment.title,
      issuer: null,
      dueDate: commitment.dueDate,
      dueTime: commitment.dueTime,
    });
    if (commitment.dueDate) {
      const reminders = planReminders(commitment.dueDate, {
        today: todayInZone(timeZone, now),
      });
      await insertReminders(
        tx,
        newTaskId,
        reminders.map((item) => item.localDate),
      );
    }
    const changed = await markOwnedVoiceCommitmentConfirmed(
      tx,
      userId,
      conversationId,
      commitmentId,
      newTaskId,
    );
    if (!changed) throw new VoiceReviewConflict();
    await insertAuditLog(tx, {
      actorId: userId,
      action: "voice.commitment.confirm",
      targetType: "voice_commitment",
      targetId: commitmentId,
      detail: { taskId: newTaskId },
    });
    return newTaskId;
  });

  if (!taskId) return null;
  return getTaskSummary(taskId, userId, timeZone, now);
}

export async function dismissVoiceCommitment(
  conversationId: string,
  commitmentId: string,
  userId: string,
) {
  if (!isUuid(conversationId) || !isUuid(commitmentId)) return null;
  return db().transaction(async (tx) => {
    const commitment = await lockOwnedVoiceCommitment(
      tx,
      userId,
      conversationId,
      commitmentId,
    );
    if (!commitment) return null;
    if (commitment.status !== "needs-review") throw new VoiceReviewConflict();
    const changed = await markOwnedVoiceCommitmentDismissed(
      tx,
      userId,
      conversationId,
      commitmentId,
    );
    if (!changed) throw new VoiceReviewConflict();
    await insertAuditLog(tx, {
      actorId: userId,
      action: "voice.commitment.dismiss",
      targetType: "voice_commitment",
      targetId: commitmentId,
      detail: {},
    });
    return { id: commitmentId, status: "dismissed" as const };
  });
}
