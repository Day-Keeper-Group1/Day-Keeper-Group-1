// KAN-56: everything the home screen draws, gathered into one request.

import { after } from "next/server";

import { json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getHome } from "@/server/documents";
import { continueReadings } from "@/server/uploads";

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
  const home = await getHome(user.id, user.timeZone);

  // KAN-75: the poll is also what carries a reading on. A letter is read one
  // round per request, and a round that decided nothing leaves the next one
  // queued; this reads it, after the answer has gone, so the poll is not
  // slowed by it. Only while something is being read, so an ordinary visit
  // to Home costs nothing. src/server/uploads.ts, continueReadings.
  if (home.counts.processing > 0) {
    after(() => continueReadings(user.id));
  }

  return json(home);
});
