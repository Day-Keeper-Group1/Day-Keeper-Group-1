/** Persistence and lifecycle for browser transcripts and clear commitments. */
import "server-only";

import { z } from "zod";
import {
  conversationTranscriptSchema,
  MAX_VOICE_DURATION_MS,
} from "@/lib/contract/voice";
import { isUuid } from "@/lib/uuid";
import { db } from "@/server/db";
import { dbCause } from "@/server/db/errors";
import { clearExpiredVoiceConversations } from "@/server/db/maintenance";
import {
  claimOwnedQueuedVoice,
  findOwnedVoiceBySubmission,
  findOwnedVoiceCommitment,
  findOwnedVoiceConversation,
  insertVoiceCommitments,
  insertVoiceConversation,
  listOwnedVoiceCommitments,
  listOwnedVoiceConversations,
  lockOwnedVoiceConversation,
  markOwnedVoiceFailed,
  markOwnedVoiceReady,
} from "@/server/db/queries/voice";
import {
  commitmentExtractionProvider,
  validateCommitmentOutcome,
} from "@/server/voice";

export const MAX_TRANSCRIPT_JSON_BYTES = 128_000;
export const VOICE_STALE_AFTER_MS = 2 * 60_000;

export const saveVoiceRequestSchema = z
  .object({
    clientSubmissionId: z.uuid(),
    durationMs: z.number().int().min(1).max(MAX_VOICE_DURATION_MS),
    transcript: conversationTranscriptSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const lastEnd = Math.max(
      ...input.transcript.utterances.map((line) => line.endMs),
    );
    if (lastEnd > input.durationMs || lastEnd > MAX_VOICE_DURATION_MS) {
      context.addIssue({
        code: "custom",
        path: ["transcript"],
        message: "Transcript timestamps exceed the recording duration.",
      });
    }
    const textLength = input.transcript.utterances.reduce(
      (sum, line) => sum + line.text.length,
      0,
    );
    if (textLength > 50_000) {
      context.addIssue({
        code: "custom",
        path: ["transcript"],
        message: "Transcript is too long.",
      });
    }
  });

export type SaveVoiceRequest = z.infer<typeof saveVoiceRequestSchema>;

/** Browser retries with the same key receive the original record. */
export async function saveVoiceConversation(
  userId: string,
  input: SaveVoiceRequest,
) {
  const id = await insertVoiceConversation(db(), { userId, ...input });
  if (id) return { id, status: "queued" as const, created: true };
  const existing = await findOwnedVoiceBySubmission(
    db(),
    userId,
    input.clientSubmissionId,
  );
  if (!existing)
    throw new Error("Voice submission disappeared after conflict.");
  return { ...existing, created: false };
}

/** Clear a host-interrupted transcript even if its browser was closed. */
export async function clearStaleVoice(): Promise<number> {
  const rows = await clearExpiredVoiceConversations(
    db(),
    new Date(Date.now() - VOICE_STALE_AFTER_MS),
  );
  return rows.length;
}

export async function listVoiceConversations(userId: string) {
  await clearStaleVoice();
  return (await listOwnedVoiceConversations(db(), userId)).map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getVoiceConversation(id: string, userId: string) {
  if (!isUuid(id)) return null;
  await clearStaleVoice();
  const row = await findOwnedVoiceConversation(db(), userId, id);
  if (!row) return null;
  const commitments =
    row.status === "ready"
      ? await listOwnedVoiceCommitments(db(), userId, id)
      : [];
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    commitments,
    ...(row.status === "failed" && {
      message: "We could not find commitments this time.",
    }),
  };
}

export async function getVoiceCommitment(
  conversationId: string,
  commitmentId: string,
  userId: string,
) {
  if (!isUuid(conversationId) || !isUuid(commitmentId)) return null;
  const row = await findOwnedVoiceCommitment(
    db(),
    userId,
    conversationId,
    commitmentId,
  );
  if (!row?.transcript) return null;
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    evidence: row.evidence,
    taskId: row.taskId,
    transcript: row.transcript,
  };
}

/** One model call, detached from the save response but still host-time-limited. */
export async function extractSavedVoice(id: string, userId: string) {
  const transcript = await claimOwnedQueuedVoice(db(), userId, id);
  if (!transcript) return;

  try {
    const provider = commitmentExtractionProvider();
    const outcome = validateCommitmentOutcome(
      transcript,
      await provider.extract(transcript),
    );
    const clear = outcome.payload.commitments.filter(
      (item) => item.status === "clear",
    );
    if (clear.some((item) => item.dueTime && !item.dueDate)) {
      throw new Error("Voice provider returned a time without a date.");
    }

    await db().transaction(async (tx) => {
      const locked = await lockOwnedVoiceConversation(tx, userId, id);
      if (locked?.status !== "processing") return;
      await insertVoiceCommitments(
        tx,
        id,
        clear.map((item) => ({
          proposalKey: item.id,
          title: item.title,
          dueDate: item.dueDate,
          dueTime: item.dueTime,
          evidence: item.evidence,
        })),
      );
      await markOwnedVoiceReady(tx, userId, id);
    });
  } catch (error) {
    // Only metadata is logged; provider answers may contain private transcript text.
    console.error("[voice] extraction failed", {
      conversationId: id,
      reason: error instanceof Error ? error.name : "unknown",
    });
    try {
      await db().transaction(async (tx) => {
        const locked = await lockOwnedVoiceConversation(tx, userId, id);
        if (locked?.status !== "processing") return;
        await markOwnedVoiceFailed(tx, userId, id, "extraction_failed");
      });
    } catch (cleanupError) {
      console.error("[voice] failure cleanup could not complete", {
        conversationId: id,
        reason: String(dbCause(cleanupError)),
      });
    }
  }
}
