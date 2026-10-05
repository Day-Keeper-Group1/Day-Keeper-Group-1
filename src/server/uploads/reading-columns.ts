// KAN-92: which values of a reading reach the letter's own columns.
/**
 * From a reading to the columns of a letter.
 *
 * A reading is kept whole, one row per field, hedges included. The letter's
 * own row carries a copy of six of those values (who sent it, what kind of
 * letter it is, the due date and time, the amount, the reference), and this
 * file is the rule for which of them get there. ./reading.ts applies it when
 * it writes a reading onto the letter.
 *
 * Pure: no database, no bucket and no model, so tests/upload-rules.test.ts
 * holds the rule to its cases without any of them.
 *
 * Server-only because every caller is, not because any of it is secret.
 */

import "server-only";

import { isIsoDate, isWallClock } from "@/lib/contract/dates";
import {
  extraFieldsOf,
  type ExtractionResult,
} from "@/lib/contract/extraction";

/**
 * The value of one field, and only when the model was sure of it.
 *
 * Written here rather than by reusing fieldOf() from the contract, because that
 * helper answers for the six required fields while `due_time` is an optional
 * one, and asking two different ways would be two places to get it wrong.
 */
function confidentValue(result: ExtractionResult, key: string): string | null {
  const field = result.fields.find((f) => f.key === key);
  if (!field || field.status !== "confirmed") return null;
  return field.value;
}

/**
 * What a reading writes onto the document row.
 *
 * Confident values only. A hedged date or an unreadable reference stays null
 * here and lives one table over, in extracted_fields, as evaluation data: a
 * value the model was unsure of never reaches a document, a screen or the
 * calendar (src/lib/contract/api.ts). The hedge is kept, and it is kept out of
 * sight.
 *
 * The two format checks are the last gate before a column with an opinion. A
 * model that answers "sometime in August" for a due date is confidently wrong
 * about the format rather than hedging, and Postgres would answer that with an
 * error arriving long after the reading is over.
 *
 * Pure, so the rule can be tested without a database and without a model.
 */
export function columnsFromReading(result: ExtractionResult): {
  issuer: string | null;
  documentType: string | null;
  dueDate: string | null;
  dueTime: string | null;
  amountText: string | null;
  reference: string | null;
  openPayload: Record<string, unknown>;
} {
  const dueDateValue = confidentValue(result, "due_date");
  const dueTimeValue = confidentValue(result, "due_time");
  const dueDate = dueDateValue && isIsoDate(dueDateValue) ? dueDateValue : null;
  // A time of day without a date has no place to go: the calendar cannot show
  // it and no reminder can count back from it. So the time column is filled only
  // when the date column is.
  const dueTime =
    dueDate && dueTimeValue && isWallClock(dueTimeValue) ? dueTimeValue : null;

  return {
    issuer: confidentValue(result, "issuer"),
    documentType: confidentValue(result, "document_type"),
    dueDate,
    dueTime,
    amountText: confidentValue(result, "amount"),
    reference: confidentValue(result, "reference"),
    // Six fields are a floor, so anything the reader returned that this system
    // does not recognise is kept rather than dropped, beside whatever the
    // reader put in open_payload itself. Nothing reads it to make a decision;
    // src/lib/contract/fields.ts says what would have to happen first.
    openPayload: {
      ...result.open_payload,
      ...Object.fromEntries(
        extraFieldsOf(result).map((field) => [field.key, field]),
      ),
    },
  };
}
