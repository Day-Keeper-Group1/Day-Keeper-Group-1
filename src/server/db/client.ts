// KAN-92: one pool and the Drizzle handle over it, for the app, the scripts and the tests.

/**
 * How a connection to the database is made.
 *
 * The app's handle (./index.ts), the scripts in db/ and the test harness under
 * tests/db all build theirs here, so there is one answer to how many
 * connections a pool holds and whether they are encrypted.
 *
 * Script-safe: no `server-only` and nothing from src/server/env.ts, because the
 * scripts in db/ and Vitest load this file outside Next.js, where
 * `server-only` throws. The connection string is handed in by whoever calls.
 */

import {
  drizzle,
  type NodePgDatabase,
  type NodePgQueryResultHKT,
} from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool, type PoolConfig } from "pg";
import { databaseSsl } from "@/lib/database-tls";
import { hostIsLocal } from "@/lib/local-host";

/** The handle or a transaction: every query function takes one of these first. */
export type Db = PgDatabase<NodePgQueryResultHKT>;

/**
 * 10 connections and no TLS when the database is on this machine, 1 and TLS
 * otherwise.
 *
 * A database on this machine or a database somewhere else. Two things follow
 * from the second, and both are wrong to guess at.
 *
 * The connection has to be encrypted, because it now crosses a network that is
 * not this laptop. And every running copy of the app gets its own pool, so on
 * a host that runs the app as functions there can be a great many pools at
 * once; ten connections each is how a free-tier database runs out of
 * connections while the app looks idle. One connection per copy, and the pool
 * is then just the reconnect logic.
 *
 * The local Postgres in docker-compose.yml does not speak TLS at all, so
 * asking for it there fails to connect rather than quietly falling back.
 */
export function poolOptions(url: string): PoolConfig {
  return {
    connectionString: url,
    // Small: a student laptop, a free-tier database, and a handful of
    // concurrent requests. Raising this hides connection leaks rather than
    // fixing them.
    max: hostIsLocal(url) ? 10 : 1,
    // Encrypted and verified for anything not local; see
    // src/lib/database-tls.ts, which the scripts in db/ use too.
    ssl: databaseSsl(url),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

/** One pool and the Drizzle handle over it. Scripts and tests pass `{ max: 1 }`. */
export function createDb(
  url: string,
  overrides: Partial<PoolConfig> = {},
): { db: NodePgDatabase; pool: Pool } {
  const pool = new Pool({ ...poolOptions(url), ...overrides });
  // An idle client blew up. Log it rather than letting it take the process
  // down, which is the default behaviour of an unhandled 'error' event.
  pool.on("error", (err) => console.error("[db] idle client error", err));
  // No schema object is handed over: `db.query.*` is not used, so there is one
  // way to write a query, the builder.
  return { db: drizzle({ client: pool }), pool };
}
