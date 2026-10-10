/** The persisted Voice path, against PostgreSQL and the reviewed mock fixtures. */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import clearFixture from "../../data/synthetic-conversations/clear-commitment/transcript.json";
import uncertainFixture from "../../data/synthetic-conversations/unclear-agreement/transcript.json";
import { conversationTranscriptSchema } from "@/lib/contract/voice";
import { getHome } from "@/server/documents";
import {
  clearStaleVoice,
  extractSavedVoice,
  getVoiceCommitment,
  getVoiceConversation,
  saveVoiceConversation,
  saveVoiceRequestSchema,
} from "@/server/voice/records";
import {
  confirmVoiceCommitment,
  dismissVoiceCommitment,
  VoiceReviewConflict,
} from "@/server/voice/review";
import { getTask, listTasks } from "@/server/tasks";

import { backdate, rows } from "./support/witness";
import { aPerson, type Person } from "./support/world";

const ZONE = "Australia/Melbourne";
const clear = conversationTranscriptSchema.parse(clearFixture);
const uncertain = conversationTranscriptSchema.parse(uncertainFixture);

describe("saved Voice conversations", () => {
  let margaret: Person;
  let agnes: Person;

  beforeEach(async () => {
    margaret = await aPerson("Margaret");
    agnes = await aPerson("Agnes");
  });

  async function submit(transcript = clear) {
    return saveVoiceConversation(margaret.id, {
      clientSubmissionId: randomUUID(),
      durationMs: Math.max(...transcript.utterances.map((line) => line.endMs)),
      transcript,
    });
  }

  it("enforces the browser recording limit at the API boundary", () => {
    expect(
      saveVoiceRequestSchema.safeParse({
        clientSubmissionId: randomUUID(),
        durationMs: 45_001,
        transcript: clear,
      }).success,
    ).toBe(false);
  });

  it("saves one clear proposal in To check, then creates a shared task with transcript evidence", async () => {
    const saved = await submit();
    expect(saved.status).toBe("queued");
    expect(await getVoiceConversation(saved.id, agnes.id)).toBeNull();
    await extractSavedVoice(saved.id, margaret.id);

    const result = await getVoiceConversation(saved.id, margaret.id);
    expect(result?.status).toBe("ready");
    expect(result?.commitments).toHaveLength(1);
    const commitment = result!.commitments[0];
    expect(commitment.status).toBe("needs-review");
    expect((await getHome(margaret.id, ZONE)).voiceToCheck).toHaveLength(1);
    expect(
      await getVoiceCommitment(saved.id, commitment.id, agnes.id),
    ).toBeNull();

    const confirmed = await confirmVoiceCommitment(
      saved.id,
      commitment.id,
      margaret.id,
      ZONE,
    );
    expect(confirmed?.title).toBe("Book the doctor appointment");
    expect(confirmed?.dueDate).toBe("2026-10-02");
    expect((await getHome(margaret.id, ZONE)).voiceToCheck).toHaveLength(0);
    expect(
      (await listTasks(margaret.id, ZONE)).map((task) => task.id),
    ).toContain(confirmed!.id);

    const detail = await getTask(confirmed!.id, margaret.id, ZONE);
    expect(detail?.source).toBe("voice");
    if (detail?.source !== "voice") throw new Error("Expected a Voice task.");
    expect(detail.evidence).toEqual([0, 1]);
    expect(detail.transcript).toEqual(clear);
    expect(await getTask(confirmed!.id, agnes.id, ZONE)).toBeNull();
    await expect(
      confirmVoiceCommitment(saved.id, commitment.id, margaret.id, ZONE),
    ).rejects.toBeInstanceOf(VoiceReviewConflict);
  });

  it("discards uncertain proposals without creating To check items", async () => {
    const saved = await submit(uncertain);
    await extractSavedVoice(saved.id, margaret.id);
    expect(
      (await getVoiceConversation(saved.id, margaret.id))?.commitments,
    ).toEqual([]);
    expect((await getHome(margaret.id, ZONE)).voiceToCheck).toEqual([]);
    expect(
      await rows("SELECT count(*)::integer AS total FROM voice_commitments"),
    ).toEqual([{ total: 0 }]);
  });

  it("dismisses without creating a task", async () => {
    const saved = await submit();
    await extractSavedVoice(saved.id, margaret.id);
    const commitment = (await getVoiceConversation(saved.id, margaret.id))!
      .commitments[0];
    expect(
      await dismissVoiceCommitment(saved.id, commitment.id, margaret.id),
    ).toEqual({
      id: commitment.id,
      status: "dismissed",
    });
    expect((await getHome(margaret.id, ZONE)).voiceToCheck).toEqual([]);
    expect(await listTasks(margaret.id, ZONE)).toEqual([]);
  });

  it("clears a transcript when extraction fails or a queued host is interrupted", async () => {
    const unknown = conversationTranscriptSchema.parse({
      version: "1.0",
      utterances: [
        {
          index: 0,
          speaker: "Speaker 1",
          text: "A different conversation.",
          startMs: 0,
          endMs: 1500,
        },
      ],
    });
    const failed = await submit(unknown);
    await extractSavedVoice(failed.id, margaret.id);
    expect((await getVoiceConversation(failed.id, margaret.id))?.status).toBe(
      "failed",
    );
    expect(
      await rows("SELECT transcript FROM voice_conversations WHERE id = $1", [
        failed.id,
      ]),
    ).toEqual([{ transcript: null }]);

    const interrupted = await submit();
    await backdate(
      "voice_conversations",
      "created_at",
      interrupted.id,
      "3 minutes",
    );
    expect(await clearStaleVoice()).toBe(1);
    expect(
      (await getVoiceConversation(interrupted.id, margaret.id))?.status,
    ).toBe("failed");
    expect(
      await rows("SELECT transcript FROM voice_conversations WHERE id = $1", [
        interrupted.id,
      ]),
    ).toEqual([{ transcript: null }]);
  });
});
