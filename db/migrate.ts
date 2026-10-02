// KAN-92: bring a database up to date with db/migrations, keeping what is in it.

/**
 * Apply the migrations this database has not had yet.
 *
 * `npm run db:reset` gets to the newest schema by destroying everything first.
 * This gets there by applying only what is missing, so the rows stay: it is
 * what to run after pulling a change that added a migration, and the one line
 * a deployment pipeline will call.
 *
 * No guard stands in front of it, because it destroys nothing. Everything
 * pending is applied as one transaction, so a migration that fails leaves the
 * database as it was found.
 *
 * It takes no lock, so run it from one place at a time. Against Supabase it
 * goes through the session pooler (port 5432), not the transaction pooler,
 * with DATABASE_CA_CERT set. src/server/db/AGENTS.md, "How the database
 * changes", has the rest.
 *
 *   npm run db:migrate
 */

import { dbCause } from "../src/server/db/errors";
import { applyMigrations } from "./lib/admin";
import { connect, databaseUrl, loadEnv, maskedUrl } from "./lib/connect";

loadEnv();
const url = databaseUrl();

async function main() {
  const { db, pool } = connect(url);
  try {
    const applied = await applyMigrations(db);
    console.log(
      applied === 0
        ? `Nothing to apply: ${maskedUrl(url)} is up to date.`
        : `Applied ${applied} migration(s) to ${maskedUrl(url)}.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  // The driver's own error, out of Drizzle's wrapper (src/server/db/errors.ts).
  console.error(dbCause(error));
  process.exit(1);
});
