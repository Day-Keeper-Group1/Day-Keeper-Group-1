"use client";

// KAN-57: one task, drawn the way the prototype's .row draws it.

import Link from "next/link";
import { Check, FileText } from "lucide-react";

import type { TaskSummary } from "@/lib/contract/api";
import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import { cn } from "@/lib/utils";

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
  const when = taskWhen(task);

  const title = (
    <span
      className={cn(
        "block text-lg",
        done ? "text-ink-dim line-through" : "text-foreground",
      )}
    >
      {task.title}
    </span>
  );

  const opened = href ? (
    <Link href={href} className="flex min-h-12 min-w-0 flex-1 items-center">
      {title}
    </Link>
  ) : onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-12 min-w-0 flex-1 items-center text-left"
    >
      {title}
    </button>
  ) : (
    <span className="min-w-0 flex-1">{title}</span>
  );

  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-2 border-t border-line first:border-t-0",
        className,
      )}
    >
      {/* The tick: a 28px circle inside a 48px target, so the thing she aims at
          is bigger than the thing she sees. */}
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
          "group/tick flex size-12 shrink-0 items-center justify-center rounded-full",
          !onToggle && "cursor-default",
        )}
      >
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-success bg-success text-primary-foreground"
              : "border-ink-dim text-transparent",
            onToggle && !done && "group-hover/tick:border-primary",
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
      </button>

      {/* The title and the date are one wrapping line, not two fixed columns.
          Only the title can give in a row of shrink-0 neighbours, so in a
          narrow card it was being squeezed to nothing while its glyphs went on
          painting over the date beside it. Given a basis of 10rem the pair
          breaks onto two lines instead, which is what the prototype's row does
          on a phone anyway, and the date keeps its right edge either way. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3">
        <span className="flex min-w-0 flex-[1_1_10rem] items-center gap-2 py-1">
          {opened}
          {task.documentId ? (
            <FileText
              className="size-4 shrink-0 text-ink-dim"
              strokeWidth={1.75}
              aria-label="From a letter you photographed"
            />
          ) : null}
        </span>

        <span
          className={cn(
            "ml-auto shrink-0 text-right text-base",
            done
              ? "font-semibold text-success"
              : overdue
                ? "font-bold text-foreground"
                : "text-ink-dim",
          )}
        >
          {when}
        </span>
      </div>
    </div>
  );
}
