// KAN-57: one line of what a letter says, drawn the same way wherever it appears.

import type { ExtractedFieldView } from "@/lib/contract/api";

/**
 * One row of the prototype's `.fact` list: what it is called, and what it said.
 *
 * Three screens draw this list, the letter, the review and the calendar's day
 * sheet, so it lives in one place. Three copies of six lines is how a label
 * column quietly ends up a different width on the screen a person compares it
 * against.
 *
 * Two columns, as the prototype draws them: the name in an 84px column at 13px,
 * the value beside it at 16.5px semibold. A long value wraps inside its own
 * column rather than under the name.
 */
export function FactRow({ field }: { field: ExtractedFieldView }) {
  return (
    <div className="flex items-baseline gap-2.5 border-t border-line px-0.5 py-[11px] first:border-t-0">
      <span className="w-[84px] shrink-0 text-key text-ink-dim">
        {field.label}
      </span>
      <span className="min-w-0 flex-1 text-button font-semibold break-words">
        {field.value}
      </span>
    </div>
  );
}
