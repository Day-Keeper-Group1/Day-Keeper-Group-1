import { cookies } from "next/headers";

import { json, route } from "@/server/api/respond";
import {
  SESSION_COOKIE_NAME,
  destroySession,
  requireUser,
} from "@/server/auth/session";

/**
 * POST /api/auth/logout — end the session everywhere, not just in this browser.
 *
 * Spec: docs/api.md, "Sign out".
 */
export const POST = route(async () => {
  // Answers 401 without a session, via the wrapper. Signing out of nothing is
  // not a thing that succeeded.
  await requireUser();

  // The row is what a session is, so deleting it is what signs out. A browser
  // that keeps the cookie now holds a token that opens nothing.
  await destroySession();

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  return json({ signedOut: true });
});
