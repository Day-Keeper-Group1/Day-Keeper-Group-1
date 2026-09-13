import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { completeTask, reopenTask } from "@/server/tasks";

type Context = { params: Promise<{ id: string }> };

/** POST /api/tasks/:id/complete — tick one owned task without changing reminders. */
export const POST = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const task = await completeTask(id, user.id, user.timeZone);

  if (!task) {
    return fail("not_found", "Task not found.");
  }

  return json(task);
});

/** DELETE /api/tasks/:id/complete — undo the tick without changing reminders. */
export const DELETE = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const task = await reopenTask(id, user.id, user.timeZone);

  if (!task) {
    return fail("not_found", "Task not found.");
  }

  return json(task);
});
