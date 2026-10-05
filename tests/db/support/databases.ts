// KAN-92: the databases a test run makes for itself, and how they are named, made and dropped.

/**
 * The test databases.
 *
 * A run of the database tests never reads or writes the database in
 * DATABASE_URL. It connects to it for one purpose, to send CREATE DATABASE and
 * DROP DATABASE, and everything else happens in databases of its own beside
 * it: one template, built once per run from db/migrations, and one copy of the
 * template per test file, so files run side by side without seeing each other.
 *
 * The names say whose they are and when they were made:
 *
 *   dk_test_<8 hex of the checkout's own database name>_<run id>_t        the template
 *   dk_test_<8 hex of the checkout's own database name>_<run id>_<8 hex>  one test file
 *
 * The run id is the moment the run started, in base 36. A run drops only the
 * databases carrying its own id, so a watch and a one-off run in the same
 * checkout do not destroy each other, and what a killed run left behind is
 * recognised by its age and dropped by the next one.
 *
 * No tests in here.
 */

import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";

import { testDatabasePrefix } from "../../../scripts/lib/worktree-naming.mjs";
import type { Db } from "@/server/db/client";

/** What a run left behind is dropped once it is this old. No run takes an hour. */
const STALE_AFTER_MS = 60 * 60 * 1000;

/** The database a connection string names. */
function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

/** The same server and the same login, another database. */
export function withDatabase(url: string, name: string): string {
  const other = new URL(url);
  other.pathname = `/${name}`;
  return other.toString();
}

/** What every test database of the checkout behind `url` starts with. */
export function prefixFor(url: string): string {
  return testDatabasePrefix(databaseNameOf(url));
}

/** A new run's id: now, in base 36. */
export function newRunId(): string {
  return Date.now().toString(36);
}

/** The template of one run. 27 bytes today, 63 are allowed. */
export function templateName(prefix: string, runId: string): string {
  return `${prefix}${runId}_t`;
}

/** A name for one test file's database, in the same run as `template`. */
export function fileDatabaseName(template: string): string {
  return template.replace(/t$/, randomBytes(4).toString("hex"));
}

export async function createEmpty(admin: Db, name: string): Promise<void> {
  await admin.execute(sql`CREATE DATABASE ${sql.identifier(name)}`);
}

/**
 * Copy the template. PostgreSQL refuses while anything is connected to the
 * template (SQLSTATE 55006), which is why the global setup closes its own
 * connection to it first; a refusal is tried again a few times all the same,
 * because the connection of a file that is just finishing can still be there.
 */
export async function createFromTemplate(
  admin: Db,
  name: string,
  template: string,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await admin.execute(
        sql`CREATE DATABASE ${sql.identifier(name)} TEMPLATE ${sql.identifier(template)}`,
      );
      return;
    } catch (error) {
      // The driver's error is the cause of the one Drizzle throws.
      const { cause } = error as { cause?: { code?: string } };
      if (cause?.code !== "55006" || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
}

/** FORCE closes whatever is still connected, so a test that leaked a connection cannot block the drop. */
export async function dropDatabase(admin: Db, name: string): Promise<void> {
  await admin.execute(
    sql`DROP DATABASE IF EXISTS ${sql.identifier(name)} WITH (FORCE)`,
  );
}

/** Every database on the server whose name starts with `start`. */
async function databasesStartingWith(
  admin: Db,
  start: string,
): Promise<string[]> {
  // starts_with and not LIKE: an underscore in a LIKE pattern matches any
  // character, and these names are mostly underscores.
  const found = await admin.execute<{ datname: string }>(
    sql`select datname from pg_database where starts_with(datname, ${start}) order by datname`,
  );
  return found.rows.map((row) => row.datname);
}

/** Drop the template and every file database of one run. */
export async function dropRun(
  admin: Db,
  prefix: string,
  runId: string,
): Promise<void> {
  for (const name of await databasesStartingWith(admin, `${prefix}${runId}_`)) {
    await dropDatabase(admin, name);
  }
}

/**
 * Drop what earlier runs of this checkout left behind: a run that was killed
 * never reached its own teardown. Stale means the run id in the name is more
 * than an hour old, so a run that is under way in another terminal is left
 * alone.
 */
export async function dropStale(admin: Db, prefix: string): Promise<void> {
  for (const name of await databasesStartingWith(admin, prefix)) {
    const startedAt = parseInt(name.slice(prefix.length).split("_")[0], 36);
    if (Number.isFinite(startedAt) && Date.now() - startedAt > STALE_AFTER_MS) {
      await dropDatabase(admin, name);
    }
  }
}
