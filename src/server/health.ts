/**
 * KAN-86: is the deployed site able to do its work?
 *
 * Asked by GET /api/health, which the CD pipeline calls right after a deploy
 * (.github/workflows/ci-cd.yml). A site that is up but cannot reach its
 * database answers every page with an error, so the database is what this
 * asks about. It reads nothing of anybody's.
 */

import "server-only";

import { db } from "@/server/db";
import { dbCause } from "@/server/db/errors";
import { databaseAnswers } from "@/server/db/queries/health";

/**
 * True when the database answered a statement, false when it did not.
 *
 * The reason goes to the log and not to the caller: a driver error names a
 * host and a user, and the address is public.
 */
export async function databaseIsReachable(): Promise<boolean> {
  try {
    await databaseAnswers(db());
    return true;
  } catch (error) {
    console.error("[health] the database did not answer", dbCause(error));
    return false;
  }
}
