"use client";

// KAN-57: one task, drawn the way the prototype's .row draws it.

import Link from "next/link";
import { Check } from "lucide-react";

import type { TaskSummary } from "@/lib/contract/api";
import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import { cn } from "@/lib/utils";

/**
 * The first line of a row: what to do, without who asked.
 *
 * Titles are stored as "Pay the amount due (Telstra)", which reads well in a
 * reminder that stands alone. In a list the issuer moves down to the second
 * line beside the date, so the first line stays short enough to sit on one
 * line at phone width. A title that does not end in its own issuer is shown
 * whole.
 */
export function taskHeadline(task: TaskSummary): string {
  const suffix = task.issuer ? ` (${task.issuer})` : null;
  if (
    suffix &&
    task.title.endsWith(suffix) &&
    task.title.length > suffix.length
  ) {
    return task.title.slice(0, -suffix.length);
  }
  return task.title;
}

/** The second line of a row: who asked, then when. */
export function taskByline(task: TaskSummary): string {
  const when = taskWhen(task);
  const headline = taskHeadline(task);
  return task.issuer && headline !== task.title
    ? `${task.issuer} · ${when}`
    : when;
}

/**
 * The date column, in words.
 *
 * Overdue is told by the sentence, "was due Sat 15 Aug" set bolder, and never
 * by a red badge: red already means a failed reading in this product, and
 * colour is never the only signal (docs/theme.md). Nothing here is stored.
 * `status` came from the tick and the day in her zone, worked out while the
 * list was being built, so nothing has to notice midnight.
 *
 * A ticked task with no date says only "Done": it never had reminders, so its
 * done face does not get to claim any were switched off.
 *
 * Exported separately from the row because it is the one part worth testing
 * without rendering anything.
 */
export function taskWhen(task: TaskSummary): string {
  if (task.status === "completed") {
    return task.dueDate ? "Done · reminders off" : "Done";
  }
  if (!task.dueDate) return "No date";
  if (task.status === "overdue") {
    return `was due ${formatDueDate(task.dueDate, "short")}`;
  }
  if (task.dueTime) {
    return `${formatDueDate(task.dueDate, "short")}, ${formatDueTime(task.dueTime)}`;
  }
  return formatDueDate(task.dueDate, "short");
}

export function TaskRow({
  task,
  onToggle,
  onOpen,
  href,
  className,
}: {
  task: TaskSummary;
  /** Omit for a row that only reports, e.g. a printed summary. */
  onToggle?: (task: TaskSummary) => void;
  /**
   * Opens the task, as a button. A sibling of the tick, never a wrapper around
   * it: an interactive element inside another interactive element is invalid
   * HTML and the browser quietly breaks the inner one. Mutually exclusive with
   * `href`, and `href` wins if both arrive.
   */
  onOpen?: () => void;
  href?: string;
  className?: string;
}) {
  const done = task.status === "completed";
  const overdue = task.status === "overdue";

  // Two lines, always, at every width: what to do, then who and when. A row
  // that decided for itself whether the date fitted beside the title came out
  // a different shape each time, and the eye had to hunt for every date.
  const text = (
    <span className="block min-w-0">
      <span
        className={cn(
          "block text-row leading-snug",
          done ? "text-ink-dim line-through" : "text-foreground",
        )}
      >
        {taskHeadline(task)}
      </span>
      <span
        className={cn(
          "mt-0.5 block text-caption",
          done
            ? "font-semibold text-success"
            : overdue
              ? "font-bold text-foreground"
              : "text-ink-dim",
        )}
      >
        {taskByline(task)}
      </span>
    </span>
  );

  const opened = href ? (
    <Link href={href} className="flex min-w-0 flex-1 items-center">
      {text}
    </Link>
  ) : onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 flex-1 items-center text-left"
    >
      {text}
    </button>
  ) : (
    <span className="flex min-w-0 flex-1 items-center">{text}</span>
  );

  // The prototype's `.row`: 12px above and below, 12px between the tick and
  // the words, a line between rows.
  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 border-t border-line px-0.5 py-3 first:border-t-0",
        className,
      )}
    >
      {/* The tick: the prototype's 26px `.dot`, answering taps 11px past its
          edge, so the thing she aims at is bigger than the thing she sees. */}
      <button
        type="button"
        disabled={!onToggle}
        onClick={() => onToggle?.(task)}
        aria-pressed={done}
        aria-label={
          done
            ? `Mark "${task.title}" as not done`
            : `Mark "${task.title}" as done`
        }
        className={cn(
          "group/tick relative flex size-[26px] shrink-0 items-center justify-center rounded-full after:absolute after:-inset-[11px]",
          !onToggle && "cursor-default",
        )}
      >
        <span
          className={cn(
            "flex size-[26px] items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-success bg-success text-primary-foreground"
              : "border-ink-dim text-transparent",
            onToggle && !done && "group-hover/tick:border-primary",
          )}
        >
          <Check className="size-[15px]" strokeWidth={3} />
        </span>
      </button>

      {opened}
    </div>
  );
}
