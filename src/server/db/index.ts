/**
 * Database access.
 *
 * The app talks to PostgreSQL through Drizzle's query builder, and this file
 * is the handle a statement is run with: `db()`. The statements themselves are
 * functions in ./queries, one file per family of tables, and the tables are
 * declared in ./schema. A service calls a query function and hands it `db()`,
 * or the `tx` of a transaction the service opened with `db().transaction()`.
 * Nothing else in the app writes SQL. The rules of this folder, and the reason
 * for each, are in ./AGENTS.md.
 *
 * Server-only. Importing this from a client component would ship the connection
 * string to the browser, so the guard is a real one, not a convention.
 */

import "server-only";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { env } from "@/server/env";
import { createDb } from "./client";

/**
 * One pool per process.
 *
 * Next.js reloads modules on every edit in development, so a plain
 * module-level pool would leak a new set of connections on every save until
 * Postgres refused to accept any more. Hanging it off globalThis survives the
 * reload.
 *
 * The pool is kept beside the Drizzle handle over it, so that whoever has to
 * close the connections can reach it: the database tests do, before they drop
 * the database a test file ran on. How the pool is made is in ./client.ts.
 */
const globalForDb = globalThis as unknown as {
  __daykeeperDb?: { db: NodePgDatabase; pool: Pool };
};

/** The app's one handle, cached on globalThis because Next reloads modules on every edit. */
export function db(): NodePgDatabase {
  globalForDb.__daykeeperDb ??= createDb(env().DATABASE_URL);
  return globalForDb.__daykeeperDb.db;
}
export type { Db } from "./client";
