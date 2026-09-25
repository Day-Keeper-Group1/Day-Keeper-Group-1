// KAN-63: the reading scheme, as ordinary code over readings that came back.
/**
 * The reading scheme in docs/extraction.md, newest entry.
 *
 * The reader cell reads the letter twice. When the two readings agree on every
 * compared field, that is the answer. When they differ, the judge cell reads the
 * letter once and each field that differed takes the reading it matches. When
 * it matches neither, the round is undecided and the whole letter is read again
 * from the start (src/server/uploads.ts runs the rounds; this file decides one).
 *
 * No reading sees another. "Judge" names the third reading, not a model told
 * to referee: it gets the same prompt and the same photographs as the other
 * two, and what it is compared with is decided by ./agreement.ts, in code.
 *
 * Pure, so every decision the scheme can make is tested without a model and
 * without a database (tests/scheme.test.ts).
 */

import type {
  ExtractedFieldPayload,
  ExtractedIdentifierPayload,
  ExtractionResult,
} from "@/lib/contract/extraction";
import {
  COMPARED_FIELDS,
  type ComparedField,
  identifierIdentity,
  identifiersAgree,
  valuesAgree,
} from "./agreement";

// KAN-63: chosen in docs/extraction.md, entry dated 2026-09-15. Change there first.
export const READER = { model: "gpt-5.6-luna", effort: "medium" } as const;
export const JUDGE = { model: "gpt-5.6-terra", effort: "low" } as const;

/** How many rounds a letter gets before an undecided reading fails it. */
export const MAX_ROUNDS = 5;

/** Which model at which effort one call is made with. */
export type Cell = { model: string; effort: string };

/** What the scheme compares: the five fields, and the list of identifiers. */
export type SchemePart = ComparedField | "identifiers";

export type Decision =
  /** The reading to store, put together field by field from the readings that agreed. */
  | { outcome: "decided"; result: ExtractionResult; judged: boolean }
  /** The two readings differ on these parts and the third reading has not been made. */
  | { outcome: "needs-judge"; parts: SchemePart[] }
  /** The third reading matched neither on these parts. */
  | { outcome: "undecided"; parts: SchemePart[] };

const fieldOf = (r: ExtractionResult, key: string) =>
  r.fields.find((f) => f.key === key);

const valueOf = (r: ExtractionResult, key: ComparedField) =>
  fieldOf(r, key)?.value ?? null;

const numbersOf = (r: ExtractionResult) => r.identifiers.map((i) => i.value);

function partAgrees(
  part: SchemePart,
  x: ExtractionResult,
  y: ExtractionResult,
): boolean {
  return part === "identifiers"
    ? identifiersAgree(numbersOf(x), numbersOf(y))
    : valuesAgree(part, valueOf(x, part), valueOf(y, part));
}

/**
 * One field, from the readings that gave the same answer for it.
 *
 * The value comes from a reading that was confident of it, when one was. The
 * status is `confirmed` when any of those readings was confident: two readings
 * made independently that land on the same value are stronger evidence than
 * either reading's own hedge. Only when every one of them hedged does the field
 * stay `uncertain`, and only when none of them produced a value is it
 * `unreadable`. What the product then does with a field that is not confirmed
 * is ruled in src/lib/contract/extraction.ts.
 */
function combineField(
  key: string,
  supporters: ExtractionResult[],
): ExtractedFieldPayload {
  const candidates = supporters
    .map((r) => fieldOf(r, key))
    .filter((f): f is ExtractedFieldPayload => f !== undefined);
  const confident = candidates.find((f) => f.status === "confirmed");
  if (confident) return confident;
  const hedged = candidates.find((f) => f.value !== null);
  if (hedged) return { ...hedged, status: "uncertain" };
  return candidates[0];
}

/**
 * The identifiers the agreeing readings found, put together: every number any
 * of them listed, once, under the label it was first listed with, in the order
 * it was first listed. A number is `confirmed` when any reading was confident
 * of it.
 */
function combineIdentifiers(
  supporters: ExtractionResult[],
): ExtractedIdentifierPayload[] {
  const byNumber = new Map<string, ExtractedIdentifierPayload>();
  for (const reading of supporters) {
    for (const identifier of reading.identifiers) {
      const key = identifierIdentity(identifier.value);
      const seen = byNumber.get(key);
      if (!seen) byNumber.set(key, { ...identifier });
      else if (identifier.status === "confirmed") seen.status = "confirmed";
    }
  }
  return [...byNumber.values()];
}

/**
 * Decide one round from the two reader readings and, when it has been made,
 * the judge's.
 *
 * Fields the scheme does not compare (`document_type`, and anything else a
 * reading carries) are taken from the first reading, as is the open payload.
 */
export function decide(
  first: ExtractionResult,
  second: ExtractionResult,
  judge?: ExtractionResult,
): Decision {
  const parts: SchemePart[] = [...COMPARED_FIELDS, "identifiers"];
  const supporters = new Map<SchemePart, ExtractionResult[]>();
  const differing: SchemePart[] = [];
  const unresolved: SchemePart[] = [];

  for (const part of parts) {
    if (partAgrees(part, first, second)) {
      supporters.set(part, [first, second]);
    } else if (!judge) {
      differing.push(part);
    } else if (partAgrees(part, judge, first)) {
      supporters.set(part, [first, judge]);
    } else if (partAgrees(part, judge, second)) {
      supporters.set(part, [second, judge]);
    } else {
      unresolved.push(part);
    }
  }

  if (differing.length > 0) return { outcome: "needs-judge", parts: differing };
  if (unresolved.length > 0) return { outcome: "undecided", parts: unresolved };

  const fields = first.fields.map((field) =>
    (COMPARED_FIELDS as readonly string[]).includes(field.key)
      ? combineField(field.key, supporters.get(field.key as ComparedField)!)
      : field,
  );

  return {
    outcome: "decided",
    judged: judge !== undefined,
    result: {
      ...first,
      fields,
      identifiers: combineIdentifiers(supporters.get("identifiers")!),
    },
  };
}

/**
 * The fields that decide whether a task has a date and asks for money. A
 * decided reading in which either is not confirmed fails the letter; the rule
 * and its reason are in src/lib/contract/extraction.ts.
 */
export const MUST_BE_CONFIRMED = ["due_date", "amount"] as const;

/** Which of MUST_BE_CONFIRMED a decided reading was not confident of. */
export function unsureOfWhatMatters(result: ExtractionResult): string[] {
  return MUST_BE_CONFIRMED.filter(
    (key) => fieldOf(result, key)?.status !== "confirmed",
  );
}
