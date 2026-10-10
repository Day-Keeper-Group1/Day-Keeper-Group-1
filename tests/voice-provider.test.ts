/** KAN-88: the provider boundary shared by mock and Azure voice extraction. */

import { describe, expect, it } from "vitest";
import {
  conversationTranscriptSchema,
  type ConversationTranscript,
} from "@/lib/contract/voice";
import {
  CommitmentProviderFailure,
  validateCommitmentOutcome,
  type CommitmentProviderOutcome,
} from "@/server/voice/provider";

const transcript: ConversationTranscript = conversationTranscriptSchema.parse({
  version: "1.0",
  utterances: [
    {
      index: 0,
      speaker: "Speaker 1",
      text: "I will call the clinic tomorrow.",
      startMs: 0,
      endMs: 1800,
    },
  ],
});

function outcome(payload: unknown): CommitmentProviderOutcome {
  return {
    payload,
    model: "test-model",
    effort: "medium",
    usage: {
      inputTokens: 100,
      cachedTokens: 10,
      reasoningTokens: 20,
      outputTokens: 30,
    },
    seconds: 1.25,
  };
}

const validPayload = {
  version: "1.0",
  commitments: [
    {
      id: "commitment-1",
      title: "Call the clinic",
      dueDate: null,
      dueTime: null,
      status: "clear",
      evidence: [0],
    },
  ],
};

describe("voice commitment provider boundary", () => {
  it("returns a typed payload after contract and evidence validation", () => {
    const validated = validateCommitmentOutcome(
      transcript,
      outcome(validPayload),
    );

    expect(validated.payload.commitments[0]?.title).toBe("Call the clinic");
    expect(validated.model).toBe("test-model");
    expect(validated.usage?.inputTokens).toBe(100);
  });

  it("rejects a payload outside the commitment contract", () => {
    const invalid = outcome({ version: "1.0", commitments: "not-an-array" });

    expect(() => validateCommitmentOutcome(transcript, invalid)).toThrow(
      CommitmentProviderFailure,
    );

    try {
      validateCommitmentOutcome(transcript, invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(CommitmentProviderFailure);
      expect((error as CommitmentProviderFailure).answer).toEqual(
        invalid.payload,
      );
      expect((error as CommitmentProviderFailure).usage?.outputTokens).toBe(30);
      expect((error as CommitmentProviderFailure).seconds).toBe(1.25);
    }
  });

  it("rejects evidence that does not exist in the supplied transcript", () => {
    const invalid = outcome({
      ...validPayload,
      commitments: [{ ...validPayload.commitments[0], evidence: [4] }],
    });

    expect(() => validateCommitmentOutcome(transcript, invalid)).toThrow(
      /missing utterance 4/,
    );
  });

  it("gives provider failures retry and diagnostic defaults", () => {
    const failure = new CommitmentProviderFailure("temporary failure");

    expect(failure.name).toBe("CommitmentProviderFailure");
    expect(failure.retryable).toBe(true);
    expect(failure.answer).toBeUndefined();
    expect(failure.usage).toBeNull();
    expect(failure.seconds).toBeNull();
  });

  it("allows a provider to mark a permanent configuration failure", () => {
    const failure = new CommitmentProviderFailure("missing credentials", {
      retryable: false,
    });

    expect(failure.retryable).toBe(false);
  });
});
