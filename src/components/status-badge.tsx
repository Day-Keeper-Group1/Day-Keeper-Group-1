import { cn } from "@/lib/utils";

export type Status =
  | "confirmed"
  | "completed"
  | "needs-review"
  | "uncertain"
  | "overdue"
  | "failed"
  | "unreadable"
  | "processing"
  | "upcoming"
  | "archived";

const STATUS_LABEL: Record<Status, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  "needs-review": "Needs review",
  uncertain: "Please check",
  overdue: "Overdue",
  failed: "Failed",
  unreadable: "Unreadable",
  processing: "Processing",
  upcoming: "Upcoming",
  archived: "Archived",
};

const STATUS_CLASS: Record<Status, string> = {
  confirmed:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  completed:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  "needs-review":
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  uncertain:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  overdue:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  failed:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  unreadable:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  processing:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
  upcoming:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
  archived:
    "bg-muted text-muted-foreground border-border",
};

const STATUS_DOT: Record<Status, string> = {
  confirmed: "bg-emerald-500",
  completed: "bg-emerald-500",
  "needs-review": "bg-amber-500",
  uncertain: "bg-amber-500",
  overdue: "bg-red-500",
  failed: "bg-red-500",
  unreadable: "bg-red-500",
  processing: "bg-sky-500",
  upcoming: "bg-sky-500",
  archived: "bg-muted-foreground",
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
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[status])} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
