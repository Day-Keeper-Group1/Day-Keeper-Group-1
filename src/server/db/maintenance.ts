/** Script-safe cleanup shared by the app and Netlify's scheduled function. */
import { and, eq, lt, or } from "drizzle-orm";
import type { Db } from "./client";
import { voiceConversations } from "./schema";

/** Unscoped on purpose: interrupted transcripts must be cleared for every owner. */
export async function clearExpiredVoiceConversations(db: Db, cutoff: Date) {
  return db
    .update(voiceConversations)
    .set({
      status: "failed",
      transcript: null,
      failureCode: "interrupted",
      finishedAt: new Date(),
    })
    .where(
      or(
        and(
          eq(voiceConversations.status, "queued"),
          lt(voiceConversations.createdAt, cutoff),
        ),
        and(
          eq(voiceConversations.status, "processing"),
          lt(voiceConversations.extractionStartedAt, cutoff),
        ),
      ),
    )
    .returning({ id: voiceConversations.id });
}
