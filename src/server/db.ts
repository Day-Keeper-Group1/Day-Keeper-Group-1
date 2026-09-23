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

/**
 * How much to believe the certificate a hosted database presents.
 *
 * Encryption and identity are two things, and only the first comes free. A
 * managed Postgres is usually fronted by a connection pooler holding a
 * certificate signed by the provider's own authority, which is not in Node's
 * trust store, so verifying it fails with SELF_SIGNED_CERT_IN_CHAIN and the
 * app cannot reach its database at all.
 *
 * The usual answer found in forum threads is rejectUnauthorized: false. That
 * keeps the traffic encrypted and stops checking who is on the other end,
 * which is the half of TLS that makes encryption worth having: anything that
 * can sit between the app and the database may present its own certificate,
 * be believed, and read every password and row that goes past.
 *
 * So: hand the pool the provider's root certificate and verification works
 * properly. Supabase publishes it under Settings -> Database -> SSL
 * Configuration; paste its contents into DATABASE_CA_CERT, newlines and all.
 *
 * Without it the connection still refuses to pretend. It verifies against
 * Node's own trust store, and if that fails the error names the missing
 * variable rather than leaving someone to search the message. Turning
 * verification off is deliberate, one variable, and says so on every start.
 */
function remoteTls(): { ca?: string; rejectUnauthorized: boolean } {
  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (ca) {
    // Say so here rather than letting TLS fail.
    //
    // A certificate arrives by being copied out of a dashboard and pasted into
    // a file, and the ways that goes wrong all produce a string that is present
    // but not a certificate: an editor that turns the quotes around it into
    // typographic ones, so the value stops at the first line and the rest of
    // the file is read as more of it; a path to the downloaded file instead of
    // its contents; a copy that caught the surrounding page. Every one of them
    // reaches TLS as a handshake failure, which surfaces as a 500 on sign-in
    // with nothing pointing at this variable.
    if (
      !/^-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----$/.test(ca)
    ) {
      throw new Error(
        "DATABASE_CA_CERT is set but is not a PEM certificate.\n\n" +
          "It must hold the certificate itself, not a path to it, beginning\n" +
          "-----BEGIN CERTIFICATE----- and ending -----END CERTIFICATE-----.\n" +
          'In .env.local wrap it in straight double quotes (") and keep the\n' +
          "line breaks. Typographic quotes (\u201c \u201d) are the usual cause: an\n" +
          "editor or input method substitutes them silently and the value is\n" +
          "then read as one line.",
      );
    }
    if (process.env.DATABASE_SSL_NO_VERIFY === "yes") {
      console.warn(
        "[db] DATABASE_CA_CERT and DATABASE_SSL_NO_VERIFY are both set.\n" +
          "     The certificate wins and verification stays on. Remove\n" +
          "     DATABASE_SSL_NO_VERIFY so the file says what is happening.",
      );
    }
    return { ca, rejectUnauthorized: true };
  }

  if (process.env.DATABASE_SSL_NO_VERIFY === "yes") {
    console.warn(
      "[db] DATABASE_SSL_NO_VERIFY=yes: the database connection is encrypted\n" +
        "     but unauthenticated. Anything between this app and the database\n" +
        "     can present its own certificate and read what goes past. Set\n" +
        "     DATABASE_CA_CERT instead before this is deployed anywhere real.",
    );
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

export function pool(): Pool {
  if (!globalForDb.__daykeeperPool) {
    /**
     * A database on this machine or a database somewhere else. Two things
     * follow from the second, and both are wrong to guess at.
     *
     * The connection has to be encrypted, because it now crosses a network
     * that is not this laptop. And every running copy of the app gets its own
     * pool, so on a host that runs the app as functions there can be a great
     * many pools at once; ten connections each is how a free-tier database
     * runs out of connections while the app looks idle. One connection per
     * copy, and the pool is then just the reconnect logic.
     *
     * The local Postgres in docker-compose.yml does not speak TLS at all, so
     * asking for it there fails to connect rather than quietly falling back.
     */
    const url = env().DATABASE_URL;
    const isLocal =
      /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal|db)[:/]/.test(
        url,
      );

    globalForDb.__daykeeperPool = new Pool({
      connectionString: url,
      // Small: a student laptop, a free-tier database, and a handful of
      // concurrent requests. Raising this hides connection leaks rather than
      // fixing them.
      max: isLocal ? 10 : 1,
      ssl: isLocal ? undefined : remoteTls(),
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
