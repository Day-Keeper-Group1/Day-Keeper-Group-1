/**
 * The grouping contract.
 *
 * A batch of photographs is not a letter. Somebody clearing a week of post
 * takes ten pictures without pausing to say where one letter ends, and the only
 * component that ever sees those pictures is the pass that reads them. So that
 * pass answers two questions at once: what does this page say, and does it
 * start something new.
 *
 * Deliberately not a second model over the text. A letterhead at the top of a
 * page, the same logo as the sheet before it, a different layout: most of that
 * evidence does not survive being flattened into text, so asking for the words
 * and then paying something else to reconstruct the boundaries is discarding
 * what we already had and buying back a guess. See
 * docs/architecture/adr-005-ingestion-and-grouping.md.
 *
 * The provider is not trusted here any more than it is anywhere else. Its
 * answers are parsed, checked for the two things it can contradict itself
 * about, and only then turned into groups, which is done by the pure function
 * at the bottom of this file rather than by the model.
 */

import { z } from "zod";

/**
 * Bumped when the shape changes in a way that older stored payloads would fail.
 * Stored on every grouping run, for the same reason the extraction contract
 * stores its own: a payload read back in six weeks has to say which set of
 * rules it was written under.
 */
export const GROUPING_CONTRACT_VERSION = "1.0" as const;

/**
 * One photograph, as the reading saw it.
 *
 * `reason` is the part that looks like decoration and is not. No person is ever
 * asked to confirm the division, so this sentence is the only account of why a
 * page was placed where it was, and the only thing anybody can read when the
 * division turns out to be wrong. "Letterhead at top" and "continues the table
 * from the previous page" are the answers; "yes" is not.
 */
export const pageReadingSchema = z.object({
  /** Where this photograph fell in the batch, counting from 1. */
  position: z.number().int().min(1),
  /** Everything legible on the page. Empty is allowed; a blank sheet happens. */
  text: z.string(),
  /** False means it continues the page before it. */
  starts_new_document: z.boolean(),
  reason: z.string().min(1),
  /**
   * What this letter appears to be, from its first page: "AGL Energy,
   * electricity bill". Required on a page that starts one, null on a page that
   * continues one, because a continuation page has no letterhead to read.
   *
   * It exists so a letter has a name from the moment it exists. The six fields
   * are extracted afterwards and take a few seconds, and three rows sitting
   * there saying "reading…" with nothing to distinguish them is a queue a
   * person cannot make sense of. This is a first impression, not a field:
   * `issuer` and `document_type` replace it as soon as they are read.
   */
  label: z.string().nullable(),
});

export type PageReading = z.infer<typeof pageReadingSchema>;

export const groupingResultSchema = z
  .object({
    contract_version: z.literal(GROUPING_CONTRACT_VERSION),
    provider: z.string().min(1),
    model: z.string().nullable(),
    pages: z.array(pageReadingSchema).min(1),
  })
  .superRefine((result, ctx) => {
    const positions = result.pages.map((p) => p.position);

    const seen = new Set<number>();
    for (const position of positions) {
      if (seen.has(position)) {
        ctx.addIssue({
          code: "custom",
          message: `page ${position} appears more than once`,
          path: ["pages"],
        });
      }
      seen.add(position);
    }

    // Every photograph must come back. A reading that quietly drops page four
    // loses a page of somebody's letter, and nothing downstream would notice:
    // the letter would simply be short.
    for (let expected = 1; expected <= result.pages.length; expected++) {
      if (!seen.has(expected)) {
        ctx.addIssue({
          code: "custom",
          message: `page ${expected} is missing; every photograph in the batch must be accounted for`,
          path: ["pages"],
        });
      }
    }

    const first = result.pages.find((p) => p.position === 1);
    if (first && !first.starts_new_document) {
      ctx.addIssue({
        code: "custom",
        message:
          "the first page cannot continue a previous one; there is nothing before it",
        path: ["pages", "0", "starts_new_document"],
      });
    }

    // Every letter gets a name, and only the page that starts one can give it.
    for (const page of result.pages) {
      if (page.starts_new_document && !page.label?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: `page ${page.position} starts a letter, so it must say what that letter appears to be`,
          path: ["pages"],
        });
      }
    }
  });

export type GroupingResult = z.infer<typeof groupingResultSchema>;

/**
 * Validate a payload from a provider. A failure here is a grouping failure, not
 * a crash: the caller records it and the batch goes to `failed` with the
 * photographs still sitting in it.
 */
export function parseGroupingResult(input: unknown): GroupingResult {
  return groupingResultSchema.parse(input);
}

export function safeParseGroupingResult(input: unknown) {
  return groupingResultSchema.safeParse(input);
}

/** One letter's worth of photographs, in the order they were taken. */
export type PageGroup = {
  /** Positions within the batch, ascending. Never empty. */
  positions: number[];
  /** Why the reading said this one started. Carried through for the record. */
  reason: string;
  /** What it appears to be, so the row has a name before the fields exist. */
  label: string;
};

/**
 * Turn per-page answers into letters.
 *
 * The model decides where the boundaries are; this walks them. Keeping the
 * assembly here rather than asking the provider for the groups directly means
 * there is one place to look when a batch divides oddly, and it means the
 * boundaries can be checked (above) before anything is built on them.
 *
 * Pure: same input, same groups, no clock and no database.
 */
export function assembleGroups(result: GroupingResult): PageGroup[] {
  const ordered = [...result.pages].sort((a, b) => a.position - b.position);
  const groups: PageGroup[] = [];

  for (const page of ordered) {
    if (page.starts_new_document || groups.length === 0) {
      groups.push({
        positions: [page.position],
        reason: page.reason,
        label: page.label ?? "Unread letter",
      });
    } else {
      groups[groups.length - 1].positions.push(page.position);
    }
  }

  return groups;
}
