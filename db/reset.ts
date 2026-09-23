/**
 * Rebuild the database from schema.sql.
 *
 * There are no migrations in this project. schema.sql is the truth, and this
 * script makes the database match it by dropping everything and starting again.
 * See db/schema.sql for why we chose that and what has to change before it
 * stops being workable.
 *
 * It used to say here that this is safe because there is no production data.
 * There is now: the app is deployed, people have registered on it, and this
 * script would drop their accounts as readily as anything else. Two guards
 * stand in front of it — one asking whether the operator meant a database that
 * is not on this machine, and one asking the database whether it holds accounts
 * nobody seeded. db/real-accounts.ts says why the second is the one that
 * matters.
 *
 *   npm run db:reset
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

import { refuseIfRealAccounts } from "./real-accounts";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local first.",
  );
  process.exit(1);
}

/**
 * A guard, not a formality.
 *
 * This script drops every table. If DATABASE_URL ever points at something
 * shared, running it by reflex after a git pull would destroy everyone's work.
 * Pointing it anywhere other than a local database takes a deliberate
 * environment variable.
 */
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(
  DATABASE_URL,
);
if (!isLocal && process.env.DK_ALLOW_REMOTE_RESET !== "yes") {
  console.error(
    `Refusing to reset a database that is not local.\n\n` +
      `  DATABASE_URL: ${DATABASE_URL.replace(/:[^:@/]+@/, ":****@")}\n\n` +
      `This script drops every table. If you really mean it, set DK_ALLOW_REMOTE_RESET=yes.`,
  );
  process.exit(1);
}

async function main() {
  await refuseIfRealAccounts(
    DATABASE_URL!,
    "Rebuilding the schema drops every table, and takes them with it.",
  );

  const sql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  try {
    await db.query(sql);
    console.log("Schema rebuilt from db/schema.sql.");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
