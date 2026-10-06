/** Six scored fixtures and one unscored, fictional Azure presentation demo. */
import "server-only";
import cancelledTranscript from "../../../data/synthetic-conversations/cancelled-plan/transcript.json";
import cancelledExpected from "../../../data/synthetic-conversations/cancelled-plan/expected-commitments.json";
import clearTranscript from "../../../data/synthetic-conversations/clear-commitment/transcript.json";
import clearExpected from "../../../data/synthetic-conversations/clear-commitment/expected-commitments.json";
import missingTranscript from "../../../data/synthetic-conversations/missing-date/transcript.json";
import missingExpected from "../../../data/synthetic-conversations/missing-date/expected-commitments.json";
import multipleTranscript from "../../../data/synthetic-conversations/multiple-commitments/transcript.json";
import multipleExpected from "../../../data/synthetic-conversations/multiple-commitments/expected-commitments.json";
import noneTranscript from "../../../data/synthetic-conversations/no-commitment/transcript.json";
import noneExpected from "../../../data/synthetic-conversations/no-commitment/expected-commitments.json";
import unclearTranscript from "../../../data/synthetic-conversations/unclear-agreement/transcript.json";
import unclearExpected from "../../../data/synthetic-conversations/unclear-agreement/expected-commitments.json";
import complexTranscript from "../../../data/synthetic-conversations/complex-demo/transcript.json";
import {
  parseCommitmentExtraction,
  parseConversationTranscript,
  commitmentEvidenceIssues,
} from "@/lib/contract/voice";

const sources = [
  {
    id: "multiple",
    label: "Several commitments",
    transcript: multipleTranscript,
    expected: multipleExpected,
  },
  {
    id: "clear",
    label: "One clear commitment",
    transcript: clearTranscript,
    expected: clearExpected,
  },
  {
    id: "missing",
    label: "A commitment without a date",
    transcript: missingTranscript,
    expected: missingExpected,
  },
  {
    id: "none",
    label: "No commitments",
    transcript: noneTranscript,
    expected: noneExpected,
  },
  {
    id: "cancelled",
    label: "A cancelled plan",
    transcript: cancelledTranscript,
    expected: cancelledExpected,
  },
  {
    id: "unclear",
    label: "An unclear agreement",
    transcript: unclearTranscript,
    expected: unclearExpected,
  },
  {
    id: "complex",
    label: "Live Azure demo — no prepared answer",
    transcript: complexTranscript,
    expected: null,
  },
] as const;

export const voiceScenarios = sources.map((source) => {
  const transcript = parseConversationTranscript(source.transcript);
  const expected = source.expected
    ? parseCommitmentExtraction(source.expected)
    : null;
  if (expected) {
    const issues = commitmentEvidenceIssues(transcript, expected);
    if (issues.length)
      throw new Error(
        `Invalid voice fixture ${source.id}: ${issues.join("; ")}`,
      );
  }
  return { id: source.id, label: source.label, transcript, expected };
});

export function voiceScenario(id: string) {
  return voiceScenarios.find((scenario) => scenario.id === id);
}
