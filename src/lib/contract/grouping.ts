/**
 * The grouping contract.
 *
 * A batch of photographs is a pile, and a pile obeys no rules. A person
 * photographs a week of post in whatever order their hands fall, or picks
 * photos out of their album in whatever order they find them: the pages of one
 * letter shuffled between another's, a photograph of a grandchild in the
 * middle, a shopping receipt. Nothing about the input can be assumed, and so
 * nothing here assumes anything about it.
 *
 * Instead, the pass that looks at the photographs answers with a MANIFEST:
 * every letter it found (which photographs, in reading order, with a name),
 * and every photograph that is not part of any letter, with what it is
 * instead. The judgement is the model's, whole. There is no code that walks
 * the photographs in order, no code that second-guesses the division, and no
 * screen that asks a person to confirm it. The more chaotic the pile, the
 * less any rule written in advance could say about it, which is exactly why
 * the answer has to be judgement and the judgement has to be trusted. See
 * docs/architecture/adr-005-ingestion-and-grouping.md.
 *
 * One thing is still refused, and it is not a judgement: self-contradiction.
 * A manifest that cites photograph eleven of ten, uses the same photograph
 * twice in one letter, calls a photograph a letter's page and also not a
 * letter, or leaves a photograph unmentioned entirely, has not made a
 * decision we distrust; it has failed to say one thing. That is malformed
 * output, rejected and retried the way any bad tool call is, and a batch that
 * keeps contradicting itself fails with the responses in the log for a person
 * to read.
 */

import { z } from "zod";

/**
 * Bumped when the shape changes in a way that older stored payloads would
 * fail. Stored on every grouping run, for the same reason the extraction
 * contract stores its own: a payload read back in six weeks has to say which
 * set of rules it was written under.
 *
 * 2.0 is the manifest. 1.0 asked per-page boundary questions and is dead; see
 * the ADR's revisions.
 */
export const GROUPING_CONTRACT_VERSION = "2.0" as const;

const nonBlank = z
  .string()
  .refine((s) => s.trim().length > 0, "must not be blank");

/**
 * One letter, as the reading found it in the pile.
 */
export const letterManifestSchema = z.object({
  /**
   * The photographs this letter is made of, as positions in the batch, in
   * READING order: page one first, wherever it fell in the pile. The reading
   * can see "Page 2 of 3" printed on a sheet; capture order cannot, and
   * capture order means nothing anyway.
   */
  photos: z.array(z.number().int().min(1)).min(1),
  /**
   * What this letter appears to be, from its letterhead: "AGL Energy,
   * electricity bill". It exists so a letter has a name from the moment it
   * has an id, rather than seconds later when its fields arrive; three rows
   * saying "reading…" with nothing to tell them apart is a queue a person
   * cannot use. A first impression, not a field: `issuer` and `document_type`
   * replace it on screen as soon as they are read.
   */
  label: nonBlank,
  /**
   * Why the reading says these photographs are one letter. Nobody is asked to
   * confirm the division, so this sentence is the only account of it there
   * is, and the only thing anyone can read when it turns out wrong.
   */
  reason: nonBlank,
  /**
   * The letter's words, transcribed by the reading, in reading order. This is
   * what the per-letter field extraction works from, so the photographs are
   * looked at once and once only.
   *
   * Per LETTER, not per page, and the difference carries the shared-photo
   * case: when one photograph catches two letters lying side by side, each
   * letter's entry gets its own words, and how that photograph's words are
   * apportioned between them is the reading's judgement, like the division
   * itself. Per-page text would hand one letter's reader the other letter's
   * words mixed in.
   *
   * May be empty: a letter the reading can recognise but not make out. The
   * field extraction then fails it as unreadable, which is that path's
   * honest end.
   */
  text: z.string(),
});

export type LetterManifest = z.infer<typeof letterManifestSchema>;

/**
 * One photograph that is no letter's page: the grandchild, the receipt.
 * It stays in the batch and becomes nothing, which is an answer, not a
 * leftover.
 */
export const notLetterSchema = z.object({
  photo: z.number().int().min(1),
  /** What it is instead: "a photograph of a person, not a document". */
  reason: nonBlank,
});

export const groupingResultSchema = z
  .object({
    contract_version: z.literal(GROUPING_CONTRACT_VERSION),
    provider: z.string().min(1),
    model: z.string().nullable(),
    /** Every letter in the pile. May be empty: a pile can contain none. */
    letters: z.array(letterManifestSchema),
    /** Every photograph that is not part of any letter. May be empty. */
    not_letters: z.array(notLetterSchema),
  })
  .superRefine((result, ctx) => {
    // The same photograph twice in one letter is one page counted twice.
    result.letters.forEach((letter, index) => {
      const seen = new Set<number>();
      for (const photo of letter.photos) {
        if (seen.has(photo)) {
          ctx.addIssue({
            code: "custom",
            message: `letter ${index + 1} uses photograph ${photo} twice`,
            path: ["letters", index, "photos"],
          });
        }
        seen.add(photo);
      }
    });

    // A photograph cannot be a letter's page and also not a letter. Note what
    // is NOT checked here: the same photograph in TWO letters is allowed,
    // because two letters lying side by side can be caught in one frame.
    const inLetters = new Set(result.letters.flatMap((l) => l.photos));
    const disclaimed = new Set<number>();
    result.not_letters.forEach((entry, index) => {
      if (inLetters.has(entry.photo)) {
        ctx.addIssue({
          code: "custom",
          message: `photograph ${entry.photo} is used in a letter and also declared not one`,
          path: ["not_letters", index],
        });
      }
      if (disclaimed.has(entry.photo)) {
        ctx.addIssue({
          code: "custom",
          message: `photograph ${entry.photo} is declared not a letter twice`,
          path: ["not_letters", index],
        });
      }
      disclaimed.add(entry.photo);
    });
  });

export type GroupingResult = z.infer<typeof groupingResultSchema>;

/**
 * The contradictions between a manifest and the batch it claims to describe.
 * Separate from the schema because the schema cannot know how many
 * photographs the batch holds. Empty means none.
 */
export function manifestContradictions(
  result: GroupingResult,
  photoCount: number,
): string[] {
  const issues: string[] = [];
  const mentioned = new Set([
    ...result.letters.flatMap((l) => l.photos),
    ...result.not_letters.map((n) => n.photo),
  ]);

  for (const photo of mentioned) {
    if (photo > photoCount) {
      issues.push(
        `photograph ${photo} does not exist; the batch holds ${photoCount}`,
      );
    }
  }

  // No photograph may be passed over in silence. This is not the model being
  // second-guessed: a photograph it says nothing about is a photograph
  // somebody's page could quietly vanish into, and nothing downstream would
  // ever notice the letter was short.
  for (let photo = 1; photo <= photoCount; photo++) {
    if (!mentioned.has(photo)) {
      issues.push(
        `photograph ${photo} is unaccounted for; every photograph is a letter's page or not a letter, and the manifest must say which`,
      );
    }
  }

  return issues;
}

/** Parse and check a provider's manifest. Throws on any contradiction. */
export function parseGroupingResult(
  input: unknown,
  photoCount: number,
): GroupingResult {
  const result = groupingResultSchema.parse(input);
  const issues = manifestContradictions(result, photoCount);
  if (issues.length > 0) {
    throw new Error(`the manifest contradicts itself: ${issues.join("; ")}`);
  }
  return result;
}

export function safeParseGroupingResult(
  input: unknown,
  photoCount: number,
): { success: boolean; data?: GroupingResult; issues: string[] } {
  const parsed = groupingResultSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((i) => i.message),
    };
  }
  const issues = manifestContradictions(parsed.data, photoCount);
  if (issues.length > 0) return { success: false, issues };
  return { success: true, data: parsed.data, issues: [] };
}
