// KAN-92: how every script in db/ starts: the environment, the address, the first guard, one connection.

/**
 * The first lines of a database script.
 *
 * `db/reset.ts`, `db/migrate.ts` and `db/seed.ts` all begin the same way: read
 * the environment files, find DATABASE_URL, and open a connection. The two
 * that destroy something first ask whether the database is on this machine.
 * Each of those steps is written here once, so the three scripts cannot come
 * to disagree about which file is read first or what counts as local.
 *
 * Nothing here is run directly. Relative imports, like every script: this file
 * is loaded by tsx, outside Next.js.
 *
 * Two of these functions end the process. That is right for a script, which
 * has nothing useful left to do, and wrong anywhere else, so nothing under
 * src/ or tests/ imports this file.
 */

import { config } from "dotenv";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import { hostIsLocal } from "../../src/lib/local-host";
import { createDb } from "../../src/server/db/client";

/**
 * Read `.env.local`, then `.env`. A variable the shell already holds is kept,
 * and so is one the first file set, which is how `.env.local` wins.
 */
export function loadEnv(): void {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
}

/** DATABASE_URL, or the sentence that says where one comes from, and stop. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Copy .env.example to .env.local first.",
    );
    process.exit(1);
  }
  return url;
}

/**
 * The address as it may be printed: the user name and the password both
 * replaced by four stars, so `postgres://****@host:port/database`.
 *
 * The user name goes too. On Supabase it carries the project's id
 * (`postgres.<id>`), and this is printed in GitHub Actions, whose logs are
 * public for a public repository. GitHub hides a secret only where the whole
 * value appears, never a part of it.
 */
export function maskedUrl(url: string): string {
  return url.replace(/\/\/[^/@]*@/, "//****@");
}

/**
 * Guard one. A guard, not a formality.
 *
 * The script that calls this destroys what the database holds. If
 * DATABASE_URL ever points at something shared, running it by reflex after a
 * git pull would destroy everyone's work. Pointing it anywhere other than a
 * local database takes a deliberate environment variable.
 *
 * `verb` finishes "Refusing to ...", and `consequence` is the sentence that
 * says what would have been lost. The second guard, which asks the database
 * itself, is ./real-accounts.ts.
 */
export function refuseIfNotLocal(
  url: string,
  verb: string,
  consequence: string,
): void {
  if (hostIsLocal(url) || process.env.DK_ALLOW_REMOTE_RESET === "yes") return;

  console.error(
    `Refusing to ${verb} a database that is not local.\n\n` +
      `  DATABASE_URL: ${maskedUrl(url)}\n\n` +
      `${consequence} If you really mean it, set DK_ALLOW_REMOTE_RESET=yes.`,
  );
  process.exit(1);
}

/**
 * One connection, and the Drizzle handle over it. A script does one thing
 * after another, so one is all it uses; whoever calls this ends the pool.
 */
export function connect(url: string): { db: NodePgDatabase; pool: Pool } {
  return createDb(url, { max: 1 });
}
