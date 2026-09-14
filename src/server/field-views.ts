// KAN-56: the wording of one extracted field row, shared by the letter endpoints and the task endpoints.

/**
 * How a stored field becomes a row on a screen.
 *
 * Two endpoints draw the same thing. GET /api/documents/:id shows a letter's
 * reading, and GET /api/tasks/:id shows the reading of the letter a task came
 * from, which is what makes "what said so?" answerable three weeks later. They
 * are written by different people in different files, so the label, the display
 * value and the collapse of a hedged status live here rather than in either of
 * them: two surfaces cannot spell "Reference" differently, or disagree about
 * whether a value the model was unsure of is shown, if neither of them decides.
 *
 * The rules themselves are the contract's, in src/lib/contract/fields.ts and
 * src/lib/contract/extraction.ts. This module only applies them.
 *
 * Server-only because every caller is, not because any of it is secret.
 */

import "server-only";

import type { ExtractedFieldView, IdentifierView } from "@/lib/contract/api";
import { formatDueDate, isIsoDate } from "@/lib/contract/dates";
import {
  FIELD_LABELS,
  NOT_APPLICABLE,
  OPTIONAL_FIELD_KEYS,
  OPTIONAL_FIELD_LABELS,
  isContractFieldKey,
  type OptionalFieldKey,
} from "@/lib/contract/fields";

/** One row of extracted_fields, as the queries in this repository select it. */
export type ExtractedFieldRow = {
  field_key: string;
  extracted_value: string | null;
  status: "confirmed" | "uncertain" | "unreadable";
};

/**
 * What a field is called on screen.
 *
 * The contract's own wording for the keys it knows, and a readable fallback for
 * anything else. The fallback exists because six fields are a floor rather than
 * a ceiling: a richer reader may return a key nobody has decided on yet, and a
 * screen should print "Bpay biller code" at a person rather than
 * "bpay_biller_code".
 */
export function fieldLabel(key: string): string {
  if (isContractFieldKey(key)) return FIELD_LABELS[key];
  if ((OPTIONAL_FIELD_KEYS as readonly string[]).includes(key)) {
    return OPTIONAL_FIELD_LABELS[key as OptionalFieldKey];
  }
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * One stored field, as the browser receives it.
 *
 * `uncertain` collapses to `unreadable` and loses its value on the way out,
 * because the product treats a hedge and a blank alike and nobody is asked to
 * adjudicate a model's hesitation (src/lib/contract/extraction.ts). The stored
 * row keeps both apart, which is what makes it evaluation data.
 *
 * A confident due date is printed the way the review screen says dates,
 * "15 Aug 2026". A confident due date that is not a date at all, which is what a
 * reader answering NOT_APPLICABLE produces, is shown as it was stored: running
 * it through a date formatter would throw, and a letter would fail to render
 * over a field that was answered correctly.
 */
export function mapField(row: ExtractedFieldRow): ExtractedFieldView {
  const confirmed = row.status === "confirmed";
  const value = confirmed ? row.extracted_value : null;
  const isDate =
    row.field_key === "due_date" && value !== null && isIsoDate(value);

  return {
    key: row.field_key,
    label: fieldLabel(row.field_key),
    value: isDate ? formatDueDate(value, "fact") : value,
    status: confirmed ? "confirmed" : "unreadable",
  };
}

/** KAN-58: one row of extracted_identifiers, as the queries select it. */
export type ExtractedIdentifierRow = {
  label: string;
  value: string;
  status: "confirmed" | "uncertain";
};

const collapse = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * KAN-58: the numbers a letter printed, as the browser receives them.
 *
 * Confident rows only, the same rule as for fields. The one whose value is the
 * confident `reference` is marked and moved to the front, compared the way the
 * contract says the reference is written, spacing kept but runs of spaces and
 * case not significant. `fields` are the views already made from the same
 * reading, so the reference is read once.
 */
export function identifierViews(
  rows: ExtractedIdentifierRow[],
  fields: ExtractedFieldView[],
): IdentifierView[] {
  const reference = fields.find(
    (field) =>
      field.key === "reference" &&
      field.status === "confirmed" &&
      field.value !== null &&
      field.value !== NOT_APPLICABLE,
  )?.value;
  const views = rows
    .filter((row) => row.status === "confirmed")
    .map((row) => ({
      label: row.label,
      value: row.value,
      isReference:
        reference !== undefined &&
        reference !== null &&
        collapse(row.value) === collapse(reference),
    }));
  return [
    ...views.filter((view) => view.isReference),
    ...views.filter((view) => !view.isReference),
  ];
}
