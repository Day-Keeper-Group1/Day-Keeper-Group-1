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

import { Client } from "pg";

/** Every account the seed creates lives here. See db/seed.ts. */
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
  const db = new Client({ connectionString });
  await db.connect();
  try {
    const table = await db.query<{ present: boolean }>(
      `select to_regclass('public.users') is not null as present`,
    );
    if (!table.rows[0]?.present) return [];

    const found = await db.query<{ email: string }>(
      `select email from users
        where lower(btrim(email)) not like $1
        order by email`,
      [`%${SEED_DOMAIN}`],
    );
    return found.rows.map((row) => row.email);
  } finally {
    await db.end();
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
    console.error(
      `Could not check this database for real accounts, so nothing has run.\n\n` +
        `  ${error instanceof Error ? error.message : String(error)}`,
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
