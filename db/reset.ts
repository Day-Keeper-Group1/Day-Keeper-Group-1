/**
 * Rebuild the database from schema.sql.
 *
 * There are no migrations in this project. schema.sql is the truth, and this
 * script makes the database match it by dropping everything and starting again.
 * That is only safe because there is no production data; see
 * docs/architecture/adr-003-data-storage.md for why we chose it and what has to
 * change before the first real user exists.
 *
 *   npm run db:reset
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

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
