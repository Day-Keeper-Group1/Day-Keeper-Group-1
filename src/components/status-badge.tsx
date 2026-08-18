import { cn } from "@/lib/utils";

export type Status =
  | "confirmed"
  | "completed"
  | "needs-review"
  | "overdue"
  | "failed"
  | "unreadable"
  | "processing"
  | "upcoming"
  | "archived"
  | "no-date";

const STATUS_LABEL: Record<Status, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  "needs-review": "Needs review",
  overdue: "Overdue",
  failed: "Failed",
  unreadable: "Unreadable",
  processing: "Processing",
  upcoming: "Upcoming",
  archived: "Archived",
  "no-date": "No date",
};

/**
 * Every badge is drawn from the theme, never from Tailwind's own palette.
 * See docs/theme.md; the two rules this file has to keep are that nothing is
 * blue (an ageing eye needs about 2400ms longer to tell blue from yellow, so
 * blue cannot carry a status), and that colour is never the only signal,
 * which is why each badge also spells its state out in words.
 *
 * There is deliberately no badge for a hedged reading: a value the model was
 * not sure of never reaches a screen at all (ADR 008), so there is nothing to
 * badge. "Needs review" keeps its unalarmed colour because this product's
 * reader tends to assume anything orange is her fault.
 *
 * "No date" (ADR 008: a letter with a clear action and no clear date still
 * becomes a task) shares "archived"'s quiet, neutral styling on purpose:
 * ADR 007 gives an overdue row no severity beyond bold text, and a dateless
 * task is not even overdue, so it earns no colour at all.
 */
const STATUS_CLASS: Record<Status, string> = {
  confirmed: "bg-success-bg text-success border-success/25",
  completed: "bg-success-bg text-success border-success/25",
  "needs-review": "bg-warn-bg text-warn border-warn/25",
  overdue: "bg-danger-bg text-danger border-danger/25",
  failed: "bg-danger-bg text-danger border-danger/25",
  unreadable: "bg-danger-bg text-danger border-danger/25",
  processing: "bg-primary-soft text-primary border-primary/25",
  upcoming: "bg-primary-soft text-primary border-primary/25",
  archived: "bg-muted text-muted-foreground border-border",
  "no-date": "bg-muted text-muted-foreground border-border",
};

const STATUS_DOT: Record<Status, string> = {
  confirmed: "bg-success",
  completed: "bg-success",
  "needs-review": "bg-dot-rem",
  overdue: "bg-dot-due",
  failed: "bg-dot-due",
  unreadable: "bg-dot-due",
  processing: "bg-primary",
  upcoming: "bg-primary",
  archived: "bg-muted-foreground",
  "no-date": "bg-muted-foreground",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASS[status],
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])}
      />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
