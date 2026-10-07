/** Recover browser transcripts left behind when a host stops extraction. */
import { createDb } from "../../src/server/db/client";
import { clearExpiredVoiceConversations } from "../../src/server/db/maintenance";

export default async function voiceCleanup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for voice cleanup.");
  }
  const { db, pool } = createDb(connectionString, { max: 1 });
  try {
    const rows = await clearExpiredVoiceConversations(
      db,
      new Date(Date.now() - 2 * 60_000),
    );
    console.info("[voice] expired transcripts cleared", rows.length);
  } finally {
    await pool.end();
  }
}
