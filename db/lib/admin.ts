// KAN-92: the three things that are done to a whole database, each written once.

/**
 * Empty it, build it, wipe its rows.
 *
 * These statements act on everything a database holds rather than on a row,
 * and none of them has a query builder form, so they are sent as they are,
 * here and nowhere else. `db:reset` drops and rebuilds with them; the database
 * tests build their template with them and wipe the rows between two tests.
 * Making and dropping a database itself is done where it is needed:
 * tests/db/support/databases.ts for the test databases, and
 * scripts/worktree-setup.mjs and scripts/worktree-teardown.mjs for a
 * worktree's own.
 *
 * Nothing here is run directly. The scripts beside this folder are what a
 * terminal calls. Relative imports, like every script: this file is loaded by
 * tsx and by Vitest, outside Next.js.
 */

import { resolve } from "node:path";
import { is, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

import type { Db } from "../../src/server/db/client";
import * as schema from "../../src/server/db/schema";

/** Where `npm run db:generate` writes, and so where the migrator reads. */
export const MIGRATIONS_FOLDER = resolve(process.cwd(), "db/migrations");

/** Leave the database with one empty `public` schema and nothing else of ours. */
export async function dropEverything(db: Db): Promise<void> {
  // Drizzle keeps its record of applied migrations in its own schema. Left
  // behind, it would make the migrator believe an empty database is up to date.
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  // Dropping and recreating public is also what leaves Supabase's API roles
  // with no grants (docs/deployment.md, "Advisor warnings you will see").
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}

/** How many migrations this database has had. None when it has never met the migrator. */
async function appliedMigrations(db: Db): Promise<number> {
  const table = await db.execute<{ present: boolean }>(
    sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`,
  );
  if (!table.rows[0].present) return 0;

  const applied = await db.execute<{ applied: number }>(
    sql`select count(*)::integer as applied from drizzle.__drizzle_migrations`,
  );
  return applied.rows[0].applied;
}

/**
 * Apply every migration under db/migrations that this database has not had
 * yet, and say how many that was.
 *
 * The migrator applies what is pending as one transaction, so a migration that
 * fails leaves the application's tables and rows as they were. It takes no
 * lock: run it from one place at a time.
 */
export async function applyMigrations(db: NodePgDatabase): Promise<number> {
  const before = await appliedMigrations(db);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return (await appliedMigrations(db)) - before;
}

/**
 * Delete every row of every table and keep the tables.
 *
 * The list is read off the schema files rather than typed out here, so a table
 * added there cannot be forgotten here. The view is not a table and is left
 * alone.
 */
export async function truncateAll(db: Db): Promise<void> {
  // The barrel also exports the enums, the view and a helper; `is` is how
  // Drizzle tells one of its tables from the rest.
  const tables = Object.values(schema).flatMap((value) =>
    is(value, PgTable) ? [sql.identifier(getTableConfig(value).name)] : [],
  );

  await db.execute(
    sql`TRUNCATE ${sql.join(tables, sql`, `)} RESTART IDENTITY CASCADE`,
  );
}
