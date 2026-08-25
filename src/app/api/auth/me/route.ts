import { json, route } from "@/server/api/respond";
import { getCurrentUser } from "@/server/auth/session";

/**
 * GET /api/auth/me — who is signed in, if anybody.
 *
 * Spec: docs/api.md, "Who is signed in".
 *
 * Nobody being signed in is `200` with `null`, not `401`. It is a normal state
 * rather than an error, and answering 401 would make every caller handle a
 * failure that has not happened. Hence getCurrentUser, deliberately not
 * requireUser.
 */
export const GET = route(async () => {
  return json({ user: await getCurrentUser() });
});
