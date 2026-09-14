"use client";

// KAN-59: a task opened from wherever its row is drawn: the tick, what its letter said, and the photographs.

import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { FactRow } from "@/components/fact-row";
import { PhotoStrip } from "@/components/photo-strip";
import { TaskRow } from "@/components/task-row";
import type { TaskDetail, TaskSummary } from "@/lib/contract/api";
import { factLines } from "@/lib/facts";

/**
 * What each task's letter said, once asked for.
 *
 * A reading never changes after it is written (nobody edits one,
 * src/lib/contract/api.ts), so a detail fetched once is true for as long as
 * the page is open, and opening the same task again asks for nothing. Only the
 * letter's half is read from it: the tick comes from the row the screen already
 * holds, which is the one that changes.
 */
const details = new Map<string, TaskDetail>();

/** The letter behind one task, or null until it has arrived. */
export function useTaskDetail(taskId: string | null): TaskDetail | null {
  // The answer is kept with the id it answers, so a sheet reopened on another
  // task never shows the last one's letter while the new one is on its way.
  const [arrived, setArrived] = useState<TaskDetail | null>(null);

  useEffect(() => {
    if (!taskId || details.has(taskId)) return;
    let live = true;
    void (async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) return;
        const fetched = (await response.json()) as TaskDetail;
        details.set(taskId, fetched);
        if (live) setArrived(fetched);
      } catch {
        // The sheet still shows the task, its tick and its date. Saying
        // nothing about the letter is honest; an error box over a task she
        // opened to tick is not.
      }
    })();
    return () => {
      live = false;
    };
  }, [taskId]);

  if (!taskId) return null;
  return details.get(taskId) ?? (arrived?.id === taskId ? arrived : null);
}

/**
 * The inside of a task's sheet, also drawn for a due day on the calendar: the
 * same row as the list with the same working tick (operations follow
 * visibility, so wherever a task is drawn it can be ticked), what its letter
 * said, and the photographs kept with it.
 */
export function TaskEntry({
  task,
  detail,
  onToggle,
}: {
  task: TaskSummary;
  detail: TaskDetail | null;
  onToggle: (task: TaskSummary) => void;
}) {
  const facts = factLines(detail?.fields ?? [], detail?.identifiers ?? []);

  return (
    <div>
      {/* `.ent .row`: no rule above, 4px above and 10px below. */}
      <TaskRow task={task} onToggle={onToggle} className="pt-1 pb-2.5" />

      {facts.length > 0 ? (
        <div>
          {facts.map((line) => (
            <FactRow key={line.key} line={line} />
          ))}
        </div>
      ) : null}

      {detail ? (
        <PhotoStrip
          documentId={detail.documentId}
          count={detail.pageCount}
          whose="task"
          className="mt-3"
        />
      ) : null}
    </div>
  );
}

/**
 * A task, opened in the sheet. Null closes it.
 *
 * The heading is the letter it came from, "Yarra Valley Water · Utility bill",
 * because the row under it already says what to do; a task whose letter named
 * neither is headed by its own title.
 */
export function TaskSheet({
  task,
  onClose,
  onToggle,
}: {
  task: TaskSummary | null;
  onClose: () => void;
  onToggle: (task: TaskSummary) => void;
}) {
  const detail = useTaskDetail(task?.id ?? null);
  const kind = detail?.fields.find(
    (field) => field.key === "document_type" && field.status === "confirmed",
  )?.value;
  const heading =
    task?.issuer && kind ? `${task.issuer} · ${kind}` : (task?.title ?? "");

  return (
    <BottomSheet open={task !== null} onClose={onClose} heading={heading}>
      {task ? (
        <TaskEntry task={task} detail={detail} onToggle={onToggle} />
      ) : null}
    </BottomSheet>
  );
}
