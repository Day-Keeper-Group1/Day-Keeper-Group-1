/**
 * Rebuild the database from the migrations.
 *
 * This drops everything the database holds and applies every migration under
 * db/migrations from the first, so what is left is exactly the database the
 * schema files in src/server/db/schema describe, with no rows in it. To bring
 * a database up to date and keep its rows, there is `npm run db:migrate`.
 *
 * It used to say here that this is safe because there is no production data.
 * There is now: the app is deployed, people have registered on it, and this
 * script would drop their accounts as readily as anything else. Two guards
 * stand in front of it: one asking whether the operator meant a database that
 * is not on this machine, and one asking the database whether it holds accounts
 * nobody seeded. db/lib/real-accounts.ts says why the second is the one that
 * matters.
 *
 * The drop and the rebuild are not one transaction. The migrations are
 * applied as a unit, so the database never stops half built; but if they fail,
 * the drop before them has already happened and the database is left empty.
 * Nothing is lost that this script was not about to destroy: run it again.
 *
 *   npm run db:reset     this, then the bucket, then the seed
 *   npm run db:schema    this alone
 */

import { dbCause } from "../src/server/db/errors";
import { applyMigrations, dropEverything } from "./lib/admin";
import { connect, databaseUrl, loadEnv, refuseIfNotLocal } from "./lib/connect";
import { refuseIfRealAccounts } from "./lib/real-accounts";

loadEnv();
const url = databaseUrl();

// Guard one: is this database on this machine?
refuseIfNotLocal(url, "reset", "This script drops every table.");

async function main() {
  // Guard two: does it hold accounts nobody seeded?
  await refuseIfRealAccounts(
    url,
    "Rebuilding the schema drops every table, and takes them with it.",
  );

  const { db, pool } = connect(url);
  try {
    await dropEverything(db);
    await applyMigrations(db);
    console.log("Schema rebuilt from db/migrations.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // The driver's own error, out of Drizzle's wrapper (src/server/db/errors.ts).
  console.error(dbCause(error));
  process.exit(1);
});
