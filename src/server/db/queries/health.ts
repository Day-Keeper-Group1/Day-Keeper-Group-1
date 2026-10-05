// KAN-86: the one statement the health check runs.

/**
 * Whether the database answers.
 *
 * No schema file has this name, because the statement reads no table. It has
 * its own file all the same, so that every statement the app runs is still in
 * ./queries and the inventory in tests/db/ownership.test.ts still sees it.
 */

import "server-only";
import type { Db } from "../client";
import { selectOne } from "../sql";

/**
 * Run `select 1`, and throw whatever the driver throws when it cannot.
 *
 * Unscoped on purpose: it reads no table and nobody's rows, only whether a
 * connection can be made and a statement answered.
 */
export async function databaseAnswers(db: Db): Promise<void> {
  await db.execute(selectOne);
}
