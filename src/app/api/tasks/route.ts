import { json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { listTasks } from "@/server/tasks";

/**
 * GET /api/tasks — every visible task owned by the signed-in person.
 *
 * This list is deliberately uncapped because it is also the calendar's source.
 * Spec: docs/api.md, "List tasks".
 */
export const GET = route(async () => {
  const user = await requireUser();
  return json(await listTasks(user.id, user.timeZone));
});
