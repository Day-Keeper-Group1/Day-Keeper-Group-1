// KAN-98: say so in CD when real model calls get close to the time they are given.

/**
 * `npm run -s db:watch-calls`
 *
 * Reads the slowest model call of the last seven days from the database it is
 * pointed at, and prints a GitHub warning when it took more than four fifths
 * of MODEL_CALL_TIMEOUT_SECONDS (src/server/time-limits.ts). Prints one line
 * either way, and never fails: the calls it looks at were made by code that
 * is already deployed, so they are no reason to stop a deploy. The warning is
 * a reason to look at the timeout before calls start running into it.
 *
 * Read-only. CD runs it after a deploy (.github/workflows/ci-cd.yml).
 */

import { desc, gt, isNotNull, and, sql } from "drizzle-orm";

import { dbCause } from "../src/server/db/errors";
import { modelCalls } from "../src/server/db/schema";
import { MODEL_CALL_TIMEOUT_SECONDS } from "../src/server/time-limits";
import { connect, databaseUrl, loadEnv } from "./lib/connect";

const DAYS = 7;
const WARN_AT_MS = MODEL_CALL_TIMEOUT_SECONDS * 1000 * 0.8;

loadEnv();
const url = databaseUrl();

async function main() {
  const { db, pool } = connect(url);
  try {
    const [slowest] = await db
      .select({
        durationMs: modelCalls.durationMs,
        role: modelCalls.role,
        model: modelCalls.model,
      })
      .from(modelCalls)
      .where(
        and(
          isNotNull(modelCalls.durationMs),
          gt(modelCalls.createdAt, sql`now() - make_interval(days => ${DAYS})`),
        ),
      )
      .orderBy(desc(modelCalls.durationMs))
      .limit(1);

    if (!slowest) {
      console.log(`No model calls in the last ${DAYS} days.`);
      return;
    }
    const seconds = (slowest.durationMs! / 1000).toFixed(1);
    const line = `The slowest model call of the last ${DAYS} days took ${seconds} s (${slowest.role}, ${slowest.model}); a call is given up on after ${MODEL_CALL_TIMEOUT_SECONDS} s.`;
    if (slowest.durationMs! > WARN_AT_MS) {
      console.log(
        `::warning title=Model calls are close to their timeout::${line} Raise MODEL_CALL_TIMEOUT_SECONDS in src/server/time-limits.ts, and run the tests: tests/time-limits.test.ts says whether a reading still fits.`,
      );
    } else {
      console.log(line);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // A warning, not a failure: see above.
  console.log(
    `::warning title=Could not read model call durations::${String(dbCause(error))}`,
  );
});
