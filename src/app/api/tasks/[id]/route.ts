import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getTask } from "@/server/tasks";

type Context = { params: Promise<{ id: string }> };

/** GET /api/tasks/:id — one owned task with its letter details. */
export const GET = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const task = await getTask(id, user.id, user.timeZone);

  if (!task) {
    return fail("not_found", "Task not found.");
  }

  return json(task);
});
