/** KAN-88: deterministic mock extraction from the approved voice fixtures. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  conversationTranscriptSchema,
  type ConversationTranscript,
} from "@/lib/contract/voice";
import { commitmentExtractionProvider } from "@/server/voice";
import { MockCommitmentExtractionProvider } from "@/server/voice/mock-provider";
import {
  CommitmentProviderFailure,
  validateCommitmentOutcome,
} from "@/server/voice/provider";

const DATA_ROOT = join(process.cwd(), "data", "synthetic-conversations");

function fixtureTranscript(name: string): ConversationTranscript {
  return conversationTranscriptSchema.parse(
    JSON.parse(readFileSync(join(DATA_ROOT, name, "transcript.json"), "utf8")),
  );
}

describe("mock voice commitment provider", () => {
  it.each([
    ["clear-commitment", 1],
    ["multiple-commitments", 3],
    ["missing-date", 1],
    ["no-commitment", 0],
    ["cancelled-plan", 0],
  ])("returns the approved %s result", async (name, count) => {
    const transcript = fixtureTranscript(name);
    const provider = new MockCommitmentExtractionProvider();
    const outcome = await provider.extract(transcript);
    const validated = validateCommitmentOutcome(transcript, outcome);

    expect(validated.payload.commitments).toHaveLength(count);
    expect(validated.model).toBeNull();
    expect(validated.effort).toBeNull();
    expect(validated.usage).toBeNull();
    expect(validated.seconds).toBeGreaterThanOrEqual(0);
  });

  it("refuses a transcript outside the curated fixture set", async () => {
    const transcript = conversationTranscriptSchema.parse({
      version: "1.0",
      utterances: [
        {
          index: 0,
          speaker: "Speaker 1",
          text: "This conversation is not a fixture.",
          startMs: 0,
          endMs: 1000,
        },
      ],
    });
    const provider = new MockCommitmentExtractionProvider();

    await expect(provider.extract(transcript)).rejects.toMatchObject({
      name: "CommitmentProviderFailure",
      retryable: false,
    });
  });

  it("uses the mock provider by name", () => {
    expect(commitmentExtractionProvider("mock")).toBeInstanceOf(
      MockCommitmentExtractionProvider,
    );
  });

  it("does not silently substitute mock when Azure is selected", () => {
    expect(() => commitmentExtractionProvider("azure")).toThrow(
      /azure is not implemented yet/,
    );
  });

  it("rejects an invalid mock delay configuration", async () => {
    const previous = process.env.MOCK_VOICE_EXTRACTION_DELAY_MS;
    process.env.MOCK_VOICE_EXTRACTION_DELAY_MS = "not-a-number";

    try {
      const provider = new MockCommitmentExtractionProvider();
      await expect(
        provider.extract(fixtureTranscript("clear-commitment")),
      ).rejects.toBeInstanceOf(CommitmentProviderFailure);
    } finally {
      if (previous === undefined) {
        delete process.env.MOCK_VOICE_EXTRACTION_DELAY_MS;
      } else {
        process.env.MOCK_VOICE_EXTRACTION_DELAY_MS = previous;
      }
    }
  });
});
