/**
 * Database access.
 *
 * Plain SQL through `pg`. There is no ORM on purpose: the schema is small, the
 * queries are the interesting part of the backend, and a teammate reading a
 * query should see exactly what hits the database. See
 * db/schema.sql.
 *
 * Server-only. Importing this from a client component would ship the connection
 * string to the browser, so the guard is a real one, not a convention.
 */

import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

/**
 * A due date is a day, not an instant.
 *
 * By default pg turns a `date` column into a JavaScript Date at midnight in the
 * server's local zone, which then serialises to UTC and can land on the day
 * before. For a product whose entire purpose is telling someone when a bill is
 * due, a date that quietly moves by one day is the worst bug it could have. So
 * `date` columns come back as the string Postgres stored, 'YYYY-MM-DD', and are
 * carried around as that string everywhere.
 *
 * 1082 is the OID for `date`.
 */
types.setTypeParser(1082, (value: string) => value);

/**
 * One pool per process.
 *
 * Next.js reloads modules on every edit in development, so a plain
 * module-level pool would leak a new set of connections on every save until
 * Postgres refused to accept any more. Hanging it off globalThis survives the
 * reload.
 */
const globalForDb = globalThis as unknown as { __daykeeperPool?: Pool };

export function pool(): Pool {
  if (!globalForDb.__daykeeperPool) {
    globalForDb.__daykeeperPool = new Pool({
      connectionString: env().DATABASE_URL,
      // Small: a student laptop, a free-tier database, and a handful of
      // concurrent requests. Raising this hides connection leaks rather than
      // fixing them.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    globalForDb.__daykeeperPool.on("error", (err) => {
      // An idle client blew up. Log it rather than letting it take the process
      // down, which is the default behaviour of an unhandled 'error' event.
      console.error("[db] idle client error", err);
    });
  }
  return globalForDb.__daykeeperPool;
}

/** Run a query and get the rows. Parameters are always bound, never interpolated. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params as unknown[]);
  return result.rows;
}

/** Run a query expecting at most one row. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run several statements as one unit.
 *
 * Confirming a document writes to four tables (the document, its fields, a
 * task, its reminders). Half of that landing would leave a person with a task
 * that has no reminders and no way to notice, so it goes in a transaction.
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
