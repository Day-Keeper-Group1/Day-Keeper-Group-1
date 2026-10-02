/**
 * Whether a database holds accounts a person made for themselves.
 *
 * db/reset.ts used to open by saying this project has no production data and
 * that dropping every table is safe until the first real user exists. That
 * stopped being true the day the app was deployed: there is now a database
 * serving a public address, and people have registered on it.
 *
 * DK_ALLOW_REMOTE_RESET was the only thing standing between a reflex and that
 * database, and it is the wrong shape for the job. It asks whether the operator
 * remembered to set a variable, and a variable that has to be set every day
 * stops being read — it becomes part of the command. It also cannot tell the
 * difference between the database that serves the public address and a second
 * hosted database kept for development, because both are equally "not local".
 *
 * So this asks a question about the database instead of about the operator:
 * does it contain accounts that nothing in this repository created?
 *
 * The seed makes accounts, and every one of them is @example.com — Margaret,
 * the operator, and one per teammate. An account outside that domain got there
 * by somebody filling in the registration form. Destroying it is almost
 * certainly a mistake, whatever variables are set, and unlike a variable this
 * travels with the database: point a script at the deployed one from any
 * machine, on any day, and it refuses.
 *
 * It is not a permission system. Anyone determined can set the override below
 * or open a SQL console. It is there to stop the accident, which is the thing
 * that actually happens.
 */

import { notLike, sql } from "drizzle-orm";

import { dbCause } from "../../src/server/db/errors";
import { users } from "../../src/server/db/schema";
import { connect } from "./connect";

/** Every account the seed creates lives here. See ./seed-world.ts. */
const SEED_DOMAIN = "@example.com";

/**
 * Deliberately not DK_ALLOW_REMOTE_RESET.
 *
 * That one is for "yes, this database is not on my machine, I meant that". This
 * one is for "yes, I am destroying accounts belonging to people who are not me".
 * Sharing a variable between the two would mean the daily answer to the first
 * question silently answers the second, which is how the development session
 * token reached the deployed database.
 */
export const OVERRIDE = "DK_DESTROY_REAL_ACCOUNTS";

/**
 * The accounts nothing here created. A database with no users table at all —
 * a fresh one, or one this script is about to build — has none.
 */
export async function realAccounts(
  connectionString: string,
): Promise<string[]> {
  // Encrypted like every other connection to a database that is not local:
  // this query reads back every account's email address.
  const { db, pool } = connect(connectionString);
  try {
    // Asked first, because the select below fails on a database that has no
    // users table, and a check that fails stops the very script that was
    // about to build that table.
    const table = await db.execute<{ present: boolean }>(
      sql`select to_regclass('public.users') is not null as present`,
    );
    if (!table.rows[0]?.present) return [];

    // email_canonical is the address lowered and trimmed, worked out by the
    // database, so " Someone@Example.COM " still counts as one of the seed's.
    const found = await db
      .select({ email: users.email })
      .from(users)
      .where(notLike(users.emailCanonical, `%${SEED_DOMAIN}`))
      .orderBy(users.email);
    return found.map((row) => row.email);
  } finally {
    await pool.end();
  }
}

/**
 * Stop, and say whose accounts were about to go.
 *
 * Names them rather than counting them: "3 accounts" invites the thought that
 * they are probably test accounts, and reading the addresses is what makes a
 * person stop. `destroys` finishes the sentence "This would destroy ...".
 */
export async function refuseIfRealAccounts(
  connectionString: string,
  destroys: string,
): Promise<void> {
  let accounts: string[];
  try {
    accounts = await realAccounts(connectionString);
  } catch (error) {
    // A database that cannot be reached cannot be checked, and a check that
    // fails open is not a check. The script that was about to run would have
    // failed on the same connection anyway, so this costs nothing.
    //
    // The driver's own message is printed, not the one Drizzle wraps it in,
    // which quotes the statement and every value bound to it.
    const cause = dbCause(error);
    console.error(
      `Could not check this database for real accounts, so nothing has run.\n\n` +
        `  ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    process.exit(1);
  }

  if (accounts.length === 0) return;
  if (process.env[OVERRIDE] === "yes") {
    console.warn(
      `${OVERRIDE}=yes: continuing even though this database holds ` +
        `${accounts.length} account(s) that nobody seeded.`,
    );
    return;
  }

  console.error(
    `Refusing: this database holds accounts that the seed did not create.\n\n` +
      accounts.map((email) => `  ${email}`).join("\n") +
      `\n\n` +
      `Somebody registered those through the app, so this is very likely the\n` +
      `deployed database rather than a development one. ${destroys}\n\n` +
      `If that is genuinely what you want, set ${OVERRIDE}=yes.`,
  );
  process.exit(1);
}
