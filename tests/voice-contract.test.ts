/**
 * KAN-87: the voice contract and its curated synthetic conversations.
 *
 * These tests need no database, storage or external API. They hold the three
 * representations of each scenario together so a script cannot quietly drift
 * away from the transcript or expected extraction used by later tickets.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  commitmentEvidenceIssues,
  commitmentExtractionSchema,
  conversationTranscriptSchema,
  safeParseCommitmentExtraction,
  safeParseConversationTranscript,
  type CommitmentExtraction,
  type ConversationTranscript,
} from "@/lib/contract/voice";

const DATA_ROOT = join(process.cwd(), "data", "synthetic-conversations");

type Scenario = {
  name: string;
  script: string;
  transcript: ConversationTranscript;
  expected: CommitmentExtraction;
};

const scenarios = readdirSync(DATA_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry): Scenario => {
    const directory = join(DATA_ROOT, entry.name);
    return {
      name: entry.name,
      script: readFileSync(join(directory, "script.md"), "utf8"),
      transcript: conversationTranscriptSchema.parse(
        JSON.parse(readFileSync(join(directory, "transcript.json"), "utf8")),
      ),
      expected: commitmentExtractionSchema.parse(
        JSON.parse(
          readFileSync(join(directory, "expected-commitments.json"), "utf8"),
        ),
      ),
    };
  });

describe("voice transcript contract", () => {
  it("accepts the approved transcript shape", () => {
    const result = safeParseConversationTranscript({
      version: "1.0",
      utterances: [
        {
          index: 0,
          speaker: "Speaker 1",
          text: "I will call tomorrow.",
          startMs: 0,
          endMs: 1200,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty, misnumbered and backwards utterances", () => {
    expect(
      safeParseConversationTranscript({ version: "1.0", utterances: [] })
        .success,
    ).toBe(false);

    expect(
      safeParseConversationTranscript({
        version: "1.0",
        utterances: [
          {
            index: 4,
            speaker: "Speaker 1",
            text: "Hello.",
            startMs: 100,
            endMs: 50,
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("voice commitment contract", () => {
  const validCommitment = {
    id: "commitment-1",
    title: "Call the clinic",
    dueDate: "2026-10-05",
    dueTime: "10:30",
    status: "clear",
    evidence: [0],
  };

  it("accepts a commitment and an empty successful result", () => {
    expect(
      safeParseCommitmentExtraction({
        version: "1.0",
        commitments: [validCommitment],
      }).success,
    ).toBe(true);
    expect(
      safeParseCommitmentExtraction({
        version: "1.0",
        commitments: [],
      }).success,
    ).toBe(true);
  });

  it("accepts unclear evidence but rejects the old approval-like status", () => {
    expect(
      safeParseCommitmentExtraction({
        version: "1.0",
        commitments: [{ ...validCommitment, status: "uncertain" }],
      }).success,
    ).toBe(true);
    expect(
      safeParseCommitmentExtraction({
        version: "1.0",
        commitments: [{ ...validCommitment, status: "confirmed" }],
      }).success,
    ).toBe(false);
  });

  it("rejects guessed formats, duplicate ids and duplicate evidence", () => {
    for (const invalid of [
      { ...validCommitment, dueDate: "5 October 2026" },
      { ...validCommitment, dueDate: "2026-02-30" },
      { ...validCommitment, dueTime: "25:00" },
      { ...validCommitment, evidence: [0, 0] },
    ]) {
      expect(
        safeParseCommitmentExtraction({
          version: "1.0",
          commitments: [invalid],
        }).success,
      ).toBe(false);
    }

    expect(
      safeParseCommitmentExtraction({
        version: "1.0",
        commitments: [validCommitment, validCommitment],
      }).success,
    ).toBe(false);
  });

  it("reports evidence that is absent from its transcript", () => {
    const transcript = conversationTranscriptSchema.parse({
      version: "1.0",
      utterances: [
        {
          index: 0,
          speaker: "Speaker 1",
          text: "I will call tomorrow.",
          startMs: 0,
          endMs: 1200,
        },
      ],
    });
    const extraction = commitmentExtractionSchema.parse({
      version: "1.0",
      commitments: [{ ...validCommitment, evidence: [2] }],
    });

    expect(commitmentEvidenceIssues(transcript, extraction)).toEqual([
      'commitment "commitment-1" refers to missing utterance 2',
    ]);
  });
});

describe("synthetic voice conversations", () => {
  it("contains the six approved scenarios", () => {
    expect(scenarios.map((scenario) => scenario.name).sort()).toEqual([
      "cancelled-plan",
      "clear-commitment",
      "missing-date",
      "multiple-commitments",
      "no-commitment",
      "unclear-agreement",
    ]);
  });

  it.each(scenarios)(
    "$name has aligned script, transcript and evidence",
    ({ script, transcript, expected }) => {
      for (const utterance of transcript.utterances) {
        expect(script).toContain(`**${utterance.speaker}:** ${utterance.text}`);
      }
      expect(commitmentEvidenceIssues(transcript, expected)).toEqual([]);
    },
  );

  it("keeps the clear commitment details aligned", () => {
    const scenario = scenarios.find(({ name }) => name === "clear-commitment");
    expect(scenario?.expected.commitments).toEqual([
      {
        id: "clear-1",
        title: "Book the doctor appointment",
        dueDate: "2026-10-02",
        dueTime: "10:30",
        status: "clear",
        evidence: [0, 1],
      },
    ]);
  });

  it("keeps all three multiple commitments aligned", () => {
    const scenario = scenarios.find(
      ({ name }) => name === "multiple-commitments",
    );
    expect(
      scenario?.expected.commitments.map(({ title, dueDate }) => ({
        title,
        dueDate,
      })),
    ).toEqual([
      { title: "Collect the prescription", dueDate: "2026-10-03" },
      { title: "Call the clinic", dueDate: "2026-10-05" },
      { title: "Bring the groceries", dueDate: "2026-10-03" },
    ]);
  });

  it("does not invent a date for the missing-date commitment", () => {
    const scenario = scenarios.find(({ name }) => name === "missing-date");
    expect(scenario?.expected.commitments).toEqual([
      {
        id: "missing-date-1",
        title: "Mow the lawn",
        dueDate: null,
        dueTime: null,
        status: "clear",
        evidence: [1],
      },
    ]);
  });

  it("marks an unaccepted request uncertain, using both relevant lines", () => {
    const scenario = scenarios.find(({ name }) => name === "unclear-agreement");
    expect(scenario?.expected.commitments).toEqual([
      {
        id: "unclear-1",
        title: "Call the clinic to book an appointment",
        dueDate: null,
        dueTime: null,
        status: "uncertain",
        evidence: [0, 1],
      },
    ]);
  });

  it.each(["no-commitment", "cancelled-plan"])(
    "%s produces no active commitments",
    (name) => {
      const scenario = scenarios.find((candidate) => candidate.name === name);
      expect(scenario?.expected.commitments).toEqual([]);
    },
  );
});
