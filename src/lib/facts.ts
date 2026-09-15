// KAN-58: the rows "What it says" draws, shared by the letter, the review and the calendar's day sheet.

import type { ExtractedFieldView, IdentifierView } from "@/lib/contract/api";
import { formatDueTime } from "@/lib/contract/dates";
import { NOT_APPLICABLE, NO_PAYMENT_REQUIRED } from "@/lib/contract/fields";

/** A time of day the way the reading stores one, 'HH:mm'. */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The label of an appointment's date and time, shown as one row. */
export const WHEN_LABEL = "When";

/** One row: what it is called, what it said, and a line under it if any. */
export type FactLine = {
  key: string;
  label: string;
  value: string;
  note?: string;
};

/** Said under the number to give, when a letter printed more than one. */
export const QUOTE_NOTE = "The one to quote";

/**
 * What a letter says, as it may be shown.
 *
 * A value the reader was not confident of never reaches a screen, so an
 * unreadable row is not drawn (src/lib/contract/extraction.ts). Two confident values
 * have nothing to tell her and are not rows either: an appointment letter that
 * prints no reference number reports NOT_APPLICABLE, and a form with nothing
 * to pay reports NO_PAYMENT_REQUIRED. The spellings come from the contract so
 * the comparison cannot quietly stop matching (src/lib/contract/fields.ts).
 *
 * When the reading listed the numbers the letter printed, they replace the
 * Reference row, each under the label the page printed beside it: she is
 * holding the letter, and the label is how she finds the same number on the
 * page. With more than one, the one to quote carries QUOTE_NOTE. A reference
 * that is somehow not among them keeps its own row, so nothing read is lost.
 * A letter read before the list existed has no identifiers and shows its
 * Reference row as before.
 */
export function factLines(
  fields: ExtractedFieldView[],
  identifiers: IdentifierView[] = [],
): FactLine[] {
  const shown = fields.filter(
    (field) =>
      field.status === "confirmed" &&
      field.value &&
      field.value !== NO_PAYMENT_REQUIRED &&
      field.value !== NOT_APPLICABLE &&
      // KAN-59: the kind of letter is already said above the rows, beside who
      // sent it ("Yarra Valley Water · Utility bill"), so it is not a row.
      field.key !== "document_type",
  );
  const referenceListed = identifiers.some((id) => id.isReference);

  // KAN-59: an appointment happens at a time on a day, so the two are one row,
  // "When", the way the prototype writes it. A time with no date to hang on
  // is not shown at all, the same rule that keeps it off the document row
  // (columnsFromReading in src/server/uploads.ts).
  const date = shown.find((field) => field.key === "due_date");
  const time = shown.find(
    (field) => field.key === "due_time" && HH_MM.test(field.value as string),
  );

  const lines: FactLine[] = shown
    .filter(
      (field) =>
        !(
          field.key === "reference" &&
          identifiers.length > 0 &&
          referenceListed
        ) && field.key !== "due_time",
    )
    .map((field) =>
      field.key === "due_date" && date && time
        ? {
            key: "when",
            label: WHEN_LABEL,
            value: `${date.value}, ${formatDueTime(time.value as string)}`,
          }
        : {
            key: field.key,
            label: field.label,
            value: field.value as string,
          },
    );
  identifiers.forEach((id, index) => {
    lines.push({
      key: `identifier-${index}`,
      label: id.label,
      value: id.value,
      ...(id.isReference && identifiers.length > 1 ? { note: QUOTE_NOTE } : {}),
    });
  });
  return lines;
}
