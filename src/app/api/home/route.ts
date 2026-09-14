// KAN-56: everything the home screen draws, gathered into one request.

import { json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getHome } from "@/server/documents";

/**
 * GET /api/home. The counts, the inbox and the tasks, in one payload.
 *
 * Spec: docs/api.md, "Everything the home screen needs".
 *
 * One request rather than three, so the counts and the lists cannot disagree
 * with each other on screen. It is also the poll: while anything of this
 * person's is still being read the interface asks again every five seconds, and
 * one answer refreshes the count and the row together.
 */
export const GET = route(async () => {
  const user = await requireUser();
  return json(await getHome(user.id, user.timeZone));
});
