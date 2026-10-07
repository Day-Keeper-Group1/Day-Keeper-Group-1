/** Owner-scoped statements for persisted voice conversations and commitments. */
import "server-only";

import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { ConversationTranscript } from "@/lib/contract/voice";
import type { Db } from "../client";
import { voiceCommitments, voiceConversations } from "../schema";
import { dbNow } from "../sql";

function ownedConversation(userId: string) {
  return eq(voiceConversations.userId, userId);
}

export async function insertVoiceConversation(
  db: Db,
  input: {
    userId: string;
    clientSubmissionId: string;
    transcript: ConversationTranscript;
    durationMs: number;
  },
) {
  const [row] = await db
    .insert(voiceConversations)
    .values(input)
    .onConflictDoNothing({
      target: [
        voiceConversations.userId,
        voiceConversations.clientSubmissionId,
      ],
    })
    .returning({ id: voiceConversations.id });
  return row?.id ?? null;
}

export async function findOwnedVoiceConversation(
  db: Db,
  userId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(voiceConversations)
    .where(and(eq(voiceConversations.id, id), ownedConversation(userId)));
  return row ?? null;
}

export async function findOwnedVoiceBySubmission(
  db: Db,
  userId: string,
  clientSubmissionId: string,
) {
  const [row] = await db
    .select({ id: voiceConversations.id, status: voiceConversations.status })
    .from(voiceConversations)
    .where(
      and(
        ownedConversation(userId),
        eq(voiceConversations.clientSubmissionId, clientSubmissionId),
      ),
    );
  return row ?? null;
}

export async function listOwnedVoiceConversations(db: Db, userId: string) {
  return db
    .select({
      id: voiceConversations.id,
      status: voiceConversations.status,
      createdAt: voiceConversations.createdAt,
    })
    .from(voiceConversations)
    .where(ownedConversation(userId))
    .orderBy(desc(voiceConversations.createdAt), desc(voiceConversations.id))
    .limit(20);
}

export async function countOwnedVoiceProcessing(db: Db, userId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(voiceConversations)
    .where(
      and(
        ownedConversation(userId),
        inArray(voiceConversations.status, ["queued", "processing"]),
      ),
    );
  return row?.total ?? 0;
}

/** Claim at most once, returning the saved transcript to the provider. */
export async function claimOwnedQueuedVoice(
  db: Db,
  userId: string,
  id: string,
) {
  const [row] = await db
    .update(voiceConversations)
    .set({ status: "processing", extractionStartedAt: dbNow })
    .where(
      and(
        eq(voiceConversations.id, id),
        ownedConversation(userId),
        eq(voiceConversations.status, "queued"),
      ),
    )
    .returning({ transcript: voiceConversations.transcript });
  return row?.transcript ?? null;
}

/** Lock before publishing results or clearing failure, so a timeout cannot race. */
export async function lockOwnedVoiceConversation(
  db: Db,
  userId: string,
  id: string,
) {
  const [row] = await db
    .select({ status: voiceConversations.status })
    .from(voiceConversations)
    .where(and(eq(voiceConversations.id, id), ownedConversation(userId)))
    .for("update");
  return row ?? null;
}

export async function markOwnedVoiceReady(db: Db, userId: string, id: string) {
  await db
    .update(voiceConversations)
    .set({ status: "ready", finishedAt: dbNow })
    .where(and(eq(voiceConversations.id, id), ownedConversation(userId)));
}

export async function markOwnedVoiceFailed(
  db: Db,
  userId: string,
  id: string,
  failureCode: string,
) {
  await db
    .update(voiceConversations)
    .set({
      status: "failed",
      transcript: null,
      failureCode,
      finishedAt: dbNow,
    })
    .where(and(eq(voiceConversations.id, id), ownedConversation(userId)));
}

export async function insertVoiceCommitments(
  db: Db,
  conversationId: string,
  proposals: Array<{
    proposalKey: string;
    title: string;
    dueDate: string | null;
    dueTime: string | null;
    evidence: number[];
  }>,
) {
  if (proposals.length === 0) return;
  await db.insert(voiceCommitments).values(
    proposals.map((proposal) => ({
      ...proposal,
      conversationId,
    })),
  );
}

export async function listOwnedVoiceToCheck(db: Db, userId: string) {
  return db
    .select({
      id: voiceCommitments.id,
      conversationId: voiceCommitments.conversationId,
      title: voiceCommitments.title,
      dueDate: voiceCommitments.dueDate,
      dueTime: voiceCommitments.dueTime,
      createdAt: voiceCommitments.createdAt,
    })
    .from(voiceCommitments)
    .innerJoin(
      voiceConversations,
      eq(voiceConversations.id, voiceCommitments.conversationId),
    )
    .where(
      and(
        ownedConversation(userId),
        eq(voiceCommitments.status, "needs-review"),
      ),
    )
    .orderBy(asc(voiceCommitments.createdAt), asc(voiceCommitments.id));
}

export async function listOwnedVoiceCommitments(
  db: Db,
  userId: string,
  conversationId: string,
) {
  return db
    .select({
      id: voiceCommitments.id,
      title: voiceCommitments.title,
      dueDate: voiceCommitments.dueDate,
      dueTime: voiceCommitments.dueTime,
      status: voiceCommitments.status,
      taskId: voiceCommitments.taskId,
    })
    .from(voiceCommitments)
    .innerJoin(
      voiceConversations,
      eq(voiceConversations.id, voiceCommitments.conversationId),
    )
    .where(
      and(
        ownedConversation(userId),
        eq(voiceCommitments.conversationId, conversationId),
      ),
    )
    .orderBy(asc(voiceCommitments.createdAt), asc(voiceCommitments.id));
}

/** Lock the human decision before creating a task or dismissing the item. */
export async function lockOwnedVoiceCommitment(
  db: Db,
  userId: string,
  conversationId: string,
  commitmentId: string,
) {
  const [row] = await db
    .select({
      id: voiceCommitments.id,
      status: voiceCommitments.status,
      title: voiceCommitments.title,
      dueDate: voiceCommitments.dueDate,
      dueTime: voiceCommitments.dueTime,
      evidence: voiceCommitments.evidence,
      transcript: voiceConversations.transcript,
    })
    .from(voiceCommitments)
    .innerJoin(
      voiceConversations,
      eq(voiceConversations.id, voiceCommitments.conversationId),
    )
    .where(
      and(
        ownedConversation(userId),
        eq(voiceCommitments.conversationId, conversationId),
        eq(voiceCommitments.id, commitmentId),
      ),
    )
    .for("update", { of: voiceCommitments });
  return row ?? null;
}

export async function findOwnedVoiceCommitment(
  db: Db,
  userId: string,
  conversationId: string,
  commitmentId: string,
) {
  const [row] = await db
    .select({
      id: voiceCommitments.id,
      status: voiceCommitments.status,
      title: voiceCommitments.title,
      dueDate: voiceCommitments.dueDate,
      dueTime: voiceCommitments.dueTime,
      evidence: voiceCommitments.evidence,
      taskId: voiceCommitments.taskId,
      transcript: voiceConversations.transcript,
    })
    .from(voiceCommitments)
    .innerJoin(
      voiceConversations,
      eq(voiceConversations.id, voiceCommitments.conversationId),
    )
    .where(
      and(
        ownedConversation(userId),
        eq(voiceCommitments.conversationId, conversationId),
        eq(voiceCommitments.id, commitmentId),
      ),
    );
  return row ?? null;
}

export async function findOwnedVoiceByTask(
  db: Db,
  userId: string,
  taskId: string,
) {
  const [row] = await db
    .select({
      conversationId: voiceConversations.id,
      evidence: voiceCommitments.evidence,
      transcript: voiceConversations.transcript,
    })
    .from(voiceCommitments)
    .innerJoin(
      voiceConversations,
      eq(voiceConversations.id, voiceCommitments.conversationId),
    )
    .where(
      and(
        ownedConversation(userId),
        eq(voiceCommitments.taskId, taskId),
        eq(voiceCommitments.status, "confirmed"),
      ),
    );
  return row ?? null;
}

export async function markOwnedVoiceCommitmentConfirmed(
  db: Db,
  userId: string,
  conversationId: string,
  commitmentId: string,
  taskId: string,
) {
  const [row] = await db
    .update(voiceCommitments)
    .set({ status: "confirmed", taskId, confirmedAt: dbNow })
    .where(
      and(
        eq(voiceCommitments.id, commitmentId),
        eq(voiceCommitments.conversationId, conversationId),
        eq(voiceCommitments.status, "needs-review"),
        inArray(
          voiceCommitments.conversationId,
          db
            .select({ id: voiceConversations.id })
            .from(voiceConversations)
            .where(ownedConversation(userId)),
        ),
      ),
    )
    .returning({ id: voiceCommitments.id });
  return !!row;
}

export async function markOwnedVoiceCommitmentDismissed(
  db: Db,
  userId: string,
  conversationId: string,
  commitmentId: string,
) {
  const [row] = await db
    .update(voiceCommitments)
    .set({ status: "dismissed", dismissedAt: dbNow })
    .where(
      and(
        eq(voiceCommitments.id, commitmentId),
        eq(voiceCommitments.conversationId, conversationId),
        eq(voiceCommitments.status, "needs-review"),
        inArray(
          voiceCommitments.conversationId,
          db
            .select({ id: voiceConversations.id })
            .from(voiceConversations)
            .where(ownedConversation(userId)),
        ),
      ),
    )
    .returning({ id: voiceCommitments.id });
  return !!row;
}
