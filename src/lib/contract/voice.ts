/**
 * The contract for the Module 3 voice prototype.
 *
 * A prepared transcript crosses from the interface to a commitment provider,
 * and the provider returns proposed commitments. Both directions are untrusted
 * at runtime: fixture JSON can drift and an AI model can return a shape it was
 * not asked for, so both shapes have validators beside their TypeScript types.
 *
 * This contract deliberately has no speaker ownership. Anonymous labels such
 * as "Speaker 1" do not establish which person is the signed-in user.
 */

import { z } from "zod";

export const VOICE_CONTRACT_VERSION = "1.0" as const;

const isoDateSchema = z.string().refine(
  (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  },
  { message: "dueDate must be a real date in YYYY-MM-DD format" },
);

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "dueTime must use HH:mm format");

export const transcriptUtteranceSchema = z
  .object({
    index: z.number().int().nonnegative(),
    speaker: z.string().trim().min(1),
    text: z.string().trim().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })
  .refine((utterance) => utterance.endMs > utterance.startMs, {
    message: "endMs must be greater than startMs",
    path: ["endMs"],
  });

export type TranscriptUtterance = z.infer<typeof transcriptUtteranceSchema>;

export const conversationTranscriptSchema = z
  .object({
    version: z.literal(VOICE_CONTRACT_VERSION),
    utterances: z.array(transcriptUtteranceSchema).min(1),
  })
  .superRefine((transcript, ctx) => {
    transcript.utterances.forEach((utterance, position) => {
      if (utterance.index !== position) {
        ctx.addIssue({
          code: "custom",
          message: `utterance index must match its zero-based position; expected ${position}`,
          path: ["utterances", position, "index"],
        });
      }

      const previous = transcript.utterances[position - 1];
      if (previous && utterance.startMs < previous.startMs) {
        ctx.addIssue({
          code: "custom",
          message: "utterances must be ordered by startMs",
          path: ["utterances", position, "startMs"],
        });
      }
    });
  });

export type ConversationTranscript = z.infer<
  typeof conversationTranscriptSchema
>;

export const commitmentProposalSchema = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    dueDate: isoDateSchema.nullable(),
    dueTime: localTimeSchema.nullable(),
    status: z.enum(["clear", "uncertain"]),
    evidence: z.array(z.number().int().nonnegative()).min(1),
  })
  .superRefine((commitment, ctx) => {
    if (new Set(commitment.evidence).size !== commitment.evidence.length) {
      ctx.addIssue({
        code: "custom",
        message: "evidence indexes must not be repeated",
        path: ["evidence"],
      });
    }
  });

export type CommitmentProposal = z.infer<typeof commitmentProposalSchema>;

export const commitmentExtractionSchema = z
  .object({
    version: z.literal(VOICE_CONTRACT_VERSION),
    commitments: z.array(commitmentProposalSchema),
  })
  .superRefine((extraction, ctx) => {
    const seen = new Set<string>();
    extraction.commitments.forEach((commitment, position) => {
      if (seen.has(commitment.id)) {
        ctx.addIssue({
          code: "custom",
          message: `commitment id "${commitment.id}" appears more than once`,
          path: ["commitments", position, "id"],
        });
      }
      seen.add(commitment.id);
    });
  });

export type CommitmentExtraction = z.infer<typeof commitmentExtractionSchema>;

export function parseConversationTranscript(
  input: unknown,
): ConversationTranscript {
  return conversationTranscriptSchema.parse(input);
}

export function safeParseConversationTranscript(input: unknown) {
  return conversationTranscriptSchema.safeParse(input);
}

export function parseCommitmentExtraction(
  input: unknown,
): CommitmentExtraction {
  return commitmentExtractionSchema.parse(input);
}

export function safeParseCommitmentExtraction(input: unknown) {
  return commitmentExtractionSchema.safeParse(input);
}

/**
 * Check the relationship between two independently valid payloads.
 *
 * Evidence numbers are only meaningful beside the transcript they refer to.
 * Providers call this after validating their answer so an out-of-range model
 * citation becomes an extraction failure instead of a broken interface state.
 */
export function commitmentEvidenceIssues(
  transcript: ConversationTranscript,
  extraction: CommitmentExtraction,
): string[] {
  const indexes = new Set(
    transcript.utterances.map((utterance) => utterance.index),
  );
  const issues: string[] = [];

  for (const commitment of extraction.commitments) {
    for (const evidence of commitment.evidence) {
      if (!indexes.has(evidence)) {
        issues.push(
          `commitment "${commitment.id}" refers to missing utterance ${evidence}`,
        );
      }
    }
  }

  return issues;
}
