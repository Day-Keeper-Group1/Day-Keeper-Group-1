// KAN-63: when two readings of one letter count as the same answer.
/**
 * What counts as two readings agreeing, with no answer key in hand.
 *
 * The reading scheme in docs/extraction.md reads a letter twice and calls a
 * third reading when the two differ. Whether they differ is decided here, and
 * only here: the product's scheme (./scheme.ts) and the experiments' replay of
 * it (experiments/module-01-extraction/shared/vote.ts) both import this file,
 * so the rule an experiment measured is the rule the product runs. Change it
 * and every past experiment's vote replay changes with it, which is the point.
 *
 * The comparisons are the scorer's own normalisations, used to compare two
 * values with each other rather than a value with the key: an amount is a
 * number, an action is its action word, a reference ignores spacing and a
 * leading "#", an issuer tolerates one name containing the other.
 *
 * Pure and without `server-only`, so the experiment scripts can import it.
 * It imports nothing through the `@/` alias for the same reason.
 */

import { actionWordOf } from "../../lib/contract/fields";

/** The fields the scheme compares, in the order a letter is read. */
export const COMPARED_FIELDS = [
  "issuer",
  "action_required",
  "due_date",
  "amount",
  "reference",
] as const;

export type ComparedField = (typeof COMPARED_FIELDS)[number];

/**
 * A reference as a person would quote it: no spaces, no leading "#", no case.
 * "#6429746 DFD" and "6429746 DFD" are the same number, and so is an article
 * number printed on a barcode line with a space after every character.
 */
export const referenceIdentity = (s: string) =>
  s.trim().replace(/^#\s*/, "").replace(/\s+/g, "").toLowerCase();

const collapse = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const isAbsent = (v: string | null, word: string) =>
  v === null || v.trim().toLowerCase() === word.toLowerCase();

/** Do two values of one field count as the same answer? */
export function valuesAgree(
  field: ComparedField,
  a: string | null,
  b: string | null,
): boolean {
  switch (field) {
    case "due_date": {
      const na = isAbsent(a, "Not applicable");
      const nb = isAbsent(b, "Not applicable");
      if (na || nb) return na && nb;
      return a!.trim() === b!.trim();
    }
    case "amount": {
      const na = isAbsent(a, "No payment required");
      const nb = isAbsent(b, "No payment required");
      if (na || nb) return na && nb;
      const x = Number(a!.replace(/[^0-9.]/g, ""));
      const y = Number(b!.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(x) || !Number.isFinite(y))
        return collapse(a!) === collapse(b!);
      return Math.abs(x - y) < 0.005;
    }
    case "reference": {
      const na = isAbsent(a, "Not applicable");
      const nb = isAbsent(b, "Not applicable");
      if (na || nb) return na && nb;
      return referenceIdentity(a!) === referenceIdentity(b!);
    }
    case "issuer": {
      if (a === null || b === null) return a === b;
      const x = loose(a);
      const y = loose(b);
      return (
        x.length > 0 &&
        y.length > 0 &&
        (x === y || x.includes(y) || y.includes(x))
      );
    }
    case "action_required": {
      if (a === null || b === null) return a === b;
      const x = actionWordOf(a);
      return x !== null && x === actionWordOf(b);
    }
  }
}

/** One identifier value as the comparison sees it. */
export const identifierIdentity = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•.–-]/g, "-");

/**
 * Do two lists of identifiers count as the same answer?
 *
 * They agree when one is within the other, compared by value. A reading often
 * lists an optional number the other leaves out, and that is not a
 * disagreement: the stored list is the two put together (./scheme.ts). Two
 * lists that each carry a number the other lacks disagree.
 */
export function identifiersAgree(a: string[], b: string[]): boolean {
  const x = new Set(a.map(identifierIdentity));
  const y = new Set(b.map(identifierIdentity));
  const within = (p: Set<string>, q: Set<string>) =>
    [...p].every((s) => q.has(s));
  return within(x, y) || within(y, x);
}
