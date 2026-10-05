/**
 * Deterministic commitment extraction for the prepared Module 3 fixtures.
 *
 * The mock is not an independent source of expected behavior. It pairs each
 * approved KAN-87 transcript with that scenario's expected commitments, so the
 * prototype and the contract tests work from the same curated ground truth.
 * An unknown transcript is refused rather than given an invented answer.
 */

import "server-only";
import cancelledExpected from "../../../data/synthetic-conversations/cancelled-plan/expected-commitments.json";
import cancelledTranscript from "../../../data/synthetic-conversations/cancelled-plan/transcript.json";
import clearExpected from "../../../data/synthetic-conversations/clear-commitment/expected-commitments.json";
import clearTranscript from "../../../data/synthetic-conversations/clear-commitment/transcript.json";
import missingDateExpected from "../../../data/synthetic-conversations/missing-date/expected-commitments.json";
import missingDateTranscript from "../../../data/synthetic-conversations/missing-date/transcript.json";
import multipleExpected from "../../../data/synthetic-conversations/multiple-commitments/expected-commitments.json";
import multipleTranscript from "../../../data/synthetic-conversations/multiple-commitments/transcript.json";
import noCommitmentExpected from "../../../data/synthetic-conversations/no-commitment/expected-commitments.json";
import noCommitmentTranscript from "../../../data/synthetic-conversations/no-commitment/transcript.json";
import {
  conversationTranscriptSchema,
  type ConversationTranscript,
} from "@/lib/contract/voice";
import {
  CommitmentProviderFailure,
  type CommitmentExtractionProvider,
  type CommitmentProviderOutcome,
} from "./provider";

const fixturePairs = [
  [clearTranscript, clearExpected],
  [multipleTranscript, multipleExpected],
  [missingDateTranscript, missingDateExpected],
  [noCommitmentTranscript, noCommitmentExpected],
  [cancelledTranscript, cancelledExpected],
] as const;

function transcriptKey(transcript: ConversationTranscript): string {
  return JSON.stringify(transcript.utterances);
}

const expectedByTranscript = new Map<string, unknown>(
  fixturePairs.map(([transcript, expected]) => [
    transcriptKey(conversationTranscriptSchema.parse(transcript)),
    expected,
  ]),
);

export class MockCommitmentExtractionProvider implements CommitmentExtractionProvider {
  readonly name = "mock";
  readonly model = null;

  async extract(
    transcript: ConversationTranscript,
  ): Promise<CommitmentProviderOutcome> {
    const started = performance.now();
    const expected = expectedByTranscript.get(transcriptKey(transcript));

    if (!expected) {
      throw new CommitmentProviderFailure(
        "voice mock has no expected result for this transcript",
        { retryable: false },
      );
    }

    const configuredDelay = process.env.MOCK_VOICE_EXTRACTION_DELAY_MS;
    const delayMs =
      configuredDelay === undefined ? 800 : Number(configuredDelay);
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new CommitmentProviderFailure(
        "MOCK_VOICE_EXTRACTION_DELAY_MS must be a non-negative number",
        { retryable: false },
      );
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return {
      payload: expected,
      model: null,
      effort: null,
      usage: null,
      seconds: (performance.now() - started) / 1000,
    };
  }
}
