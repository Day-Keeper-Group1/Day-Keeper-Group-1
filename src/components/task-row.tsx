"use client";

import Link from "next/link";
import { CalendarClock, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatTaskWhen,
  taskStatus,
  TODAY,
  type MockTask,
} from "@/lib/mock-data";

/**
 * One task, drawn the way src/lib/contract/api.ts describes: a tick a person can change in
 * either direction, forever, and everything else (overdue, "was due",
 * strike-through) worked out from that tick and the due date at render time
 * rather than stored anywhere. Used on the dashboard, the tasks page and the
 * calendar's day sheet, so the same row means the same thing everywhere it
 * appears.
 */
export function TaskRow({
  task,
  today = TODAY,
  onToggle,
  href,
  onOpen,
  className,
}: {
  task: MockTask;
  today?: string;
  /** Omit to render a read-only row (the dashboard's summary lists). */
  onToggle?: (id: string) => void;
  /** Wraps the title in a link, e.g. to the source document. */
  href?: string;
  /**
   * Wraps the title in a button instead, e.g. to open a detail sheet.
   * A sibling of the tick button, never a wrapper around this whole row:
   * nesting one interactive element inside another (a row-level button
   * around a row that already has its own tick button) is invalid HTML and
   * the browser silently breaks the nested one. Mutually exclusive with
   * `href`; `href` wins if both are passed.
   */
  onOpen?: () => void;
  className?: string;
}) {
  const status = taskStatus(task, today);
  const done = status === "completed";
  const overdue = status === "overdue";
  const appointment = Boolean(task.dueTime);
  const when = formatTaskWhen(task, today);

  const titleText = (
    <span
      className={cn(
        "block truncate text-sm font-medium",
        done ? "text-muted-foreground line-through" : "text-foreground",
      )}
    >
      {task.title}
    </span>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        overdue
          ? "border-danger/60 bg-danger-bg"
          : appointment
            ? "border-primary/40 bg-primary-soft/40"
            : "border-border",
        className,
      )}
    >
      <button
        type="button"
        disabled={!onToggle}
        onClick={() => onToggle?.(task.id)}
        aria-pressed={done}
        aria-label={
          done
            ? `Mark "${task.title}" as not done`
            : `Mark "${task.title}" as done`
        }
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          done
            ? "border-success bg-success text-primary-foreground"
            : "border-line text-transparent",
          onToggle && !done && "hover:border-primary",
          !onToggle && "cursor-default",
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>

      <span className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block min-w-0">
            {titleText}
          </Link>
        ) : onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="block w-full min-w-0 text-left"
          >
            {titleText}
          </button>
        ) : (
          titleText
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{task.issuer}</span>
          {appointment ? (
            <CalendarClock
              className="size-3 shrink-0 text-primary"
              strokeWidth={1.75}
              aria-label="Appointment"
            />
          ) : null}
          {task.documentId ? (
            <FileText
              className="size-3 shrink-0"
              strokeWidth={1.75}
              aria-label="From a photographed letter"
            />
          ) : null}
        </span>
      </span>

      <span
        className={cn(
          "shrink-0 text-right text-xs whitespace-nowrap",
          done
            ? "font-medium text-success"
            : overdue
              ? "font-bold text-danger"
              : appointment
                ? "font-semibold text-primary"
                : "text-muted-foreground",
        )}
      >
        {when}
      </span>
    </div>
  );
}
