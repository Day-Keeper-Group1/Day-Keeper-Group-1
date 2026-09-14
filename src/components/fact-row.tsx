// KAN-57: one line of what a letter says, drawn the same way wherever it appears.

import type { ExtractedFieldView } from "@/lib/contract/api";

/**
 * One row of the prototype's `.fact` list: what it is called, and what it said.
 *
 * Three screens draw this list now, the letter, the review and the calendar's
 * day sheet, so it lives in one place. Three copies of six lines is how a
 * label column quietly ends up a different width on the screen a person
 * compares it against.
 *
 * The row wraps rather than holding two fixed columns. With a label column
 * pinned at 7rem and a value that may not shrink below its longest word, a
 * narrow card was splitting "Services Australia" across lines mid-word. Given
 * a basis the value drops to its own full-width line instead, which is how the
 * same row reads on a phone.
 */
export function FactRow({ field }: { field: ExtractedFieldView }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line py-3 first:border-t-0">
      <span className="w-28 shrink-0 text-muted-foreground">{field.label}</span>
      <span className="min-w-0 flex-[1_1_10rem] font-semibold break-words">
        {field.value}
      </span>
    </div>
  );
}
