// KAN-98: where a letter's reading runs, so no request has to live past thirty seconds.

/**
 * Starting a reading, and carrying readings on.
 *
 * Netlify stops a request thirty seconds after it starts, and whatever was
 * handed to `after()` stops with it (src/server/time-limits.ts has the
 * measurements). A letter takes ten seconds a round and up to five rounds, so
 * on the deployed site the reading runs in a Netlify background function,
 * which may run for fifteen minutes: ./worker.ts. Locally nothing stops a
 * request, so the same reading runs after the answer, in the process that
 * answered.
 *
 * These two functions are the only place under src/ allowed to call
 * `after()`. A route that has slow work calls one of them;
 * tests/time-limits.test.ts turns red when a route calls `after()` itself, and
 * ./AGENTS.md says how to add a new kind of slow work.
 *
 * Server-only, like everything that reads a letter.
 */

import "server-only";

import { after } from "next/server";

import { continueReadings, readToTheEnd } from "@/server/uploads";

import { askBackgroundReader } from "./ask";

/**
 * Whether this process is running on Netlify. Netlify sets SITE_ID for its
 * functions at runtime; nothing sets it locally or in the tests. (NETLIFY
 * itself is only set while building, measured on 2026-10-09.)
 */
export function onNetlify(): boolean {
  return Boolean(process.env.SITE_ID);
}

/**
 * Read a letter whose first round has just been queued, after the answer has
 * gone.
 *
 * `firstRound` reads round one from bytes the route already holds, which
 * locally saves fetching the photographs back from the bucket. On Netlify it
 * is not used: the background reader is a separate function and fetches them.
 */
export function readInBackground(
  request: Request,
  documentId: string,
  userId: string,
  firstRound?: () => Promise<void>,
): void {
  if (onNetlify()) {
    const origin = new URL(request.url).origin;
    after(() => askBackgroundReader(origin, documentId, userId));
    return;
  }
  after(async () => {
    if (firstRound) await firstRound();
    await readToTheEnd(documentId, userId);
  });
}

/**
 * The Home poll's safety net: close rounds that were stopped, and hand every
 * letter with a round still queued to a reader (continueReadings in
 * src/server/uploads/reading.ts).
 */
export function carryOnReadings(request: Request, userId: string): void {
  if (onNetlify()) {
    const origin = new URL(request.url).origin;
    after(() =>
      continueReadings(userId, (documentId) =>
        askBackgroundReader(origin, documentId, userId),
      ),
    );
    return;
  }
  after(() => continueReadings(userId));
}
