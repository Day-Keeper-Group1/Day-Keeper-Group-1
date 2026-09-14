// KAN-57: the tick, sent to the server from wherever a task row is drawn.

import type { ApiError, TaskSummary } from "@/lib/contract/api";

/**
 * Tick a task, or untick it.
 *
 * POST to complete and DELETE to undo, both at /api/tasks/:id/complete: the
 * tick is the only thing a person writes here, it is reversible forever, and
 * the two directions are the same fact written in two moods. Neither call
 * touches a reminder row, because ticking is not a promise about reminders;
 * src/lib/contract/reminders.ts holds that reasoning.
 *
 * The endpoint answers with the task as it now stands, so a caller replaces its
 * row with what came back rather than guessing what the tick did to `status`.
 *
 * Client-safe on purpose: no `server-only` import and no database, so a row can
 * call it from wherever it is drawn.
 */
export async function toggleTaskDone(task: TaskSummary): Promise<TaskSummary> {
  const response = await fetch(`/api/tasks/${task.id}/complete`, {
    method: task.status === "completed" ? "DELETE" : "POST",
  });

  if (!response.ok) {
    throw new Error(await messageFor(response));
  }

  return (await response.json()) as TaskSummary;
}

/**
 * The sentence to show a person when the tick did not land.
 *
 * Every endpoint fails in the one envelope (src/server/api/respond.ts) and its
 * `message` is already written for a person to read, so it is shown as it
 * arrives rather than translated again here. A response that is not that
 * envelope at all, a proxy's HTML error page say, has nothing safe in it to put
 * on screen, so it gets the same blame-free sentence the server would have sent.
 */
async function messageFor(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    const message = body?.error?.message;
    if (typeof message === "string" && message.length > 0) return message;
  } catch {
    // Not our envelope. The sentence below speaks for it.
  }
  return "Something went wrong at our end. Please try again in a moment.";
}
