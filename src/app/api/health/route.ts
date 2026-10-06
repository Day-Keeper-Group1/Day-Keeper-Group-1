// KAN-86: what the CD pipeline asks a fresh deploy before it calls it done.

import { json, route } from "@/server/api/respond";
import { databaseIsReachable } from "@/server/health";

/**
 * GET /api/health. 200 when the site can reach its database, 503 when not.
 *
 * Spec: docs/api.md, "Is the site up".
 *
 * No session, and nothing in the answer but one word. 503 rather than the
 * shared error envelope's 500: nothing went wrong in this request, the site
 * is up and its database is not, which is what 503 Service Unavailable says.
 * The envelope has no code for it because no screen ever reads this answer;
 * curl in .github/workflows/ci-cd.yml does.
 */
export const GET = route(async () =>
  (await databaseIsReachable())
    ? json({ status: "ok" })
    : json({ status: "database_unreachable" }, 503),
);
