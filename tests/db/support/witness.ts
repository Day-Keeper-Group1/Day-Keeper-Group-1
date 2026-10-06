// KAN-92: a second pair of eyes on the test database, which does not go through the code under test.

/**
 * The witness.
 *
 * A test of a function that writes to the database has to look at what ended
 * up in the tables, and it must not look through the code it is testing:
 * asking Drizzle whether Drizzle stored a jsonb object proves nothing, because
 * the same mapping that wrote it wrong would read it back right. So what is
 * stored is asserted through this file: a bare `pg` client on the test file's
 * own database, and SQL written out by hand.
 *
 * It is also how a test arranges what no code writes: a session that expired
 * last week, a round that has been processing for three minutes.
 *
 * One thing to know when asserting a `date`: this client hands a `date` column
 * back as a JavaScript Date. The app's handle answers 'YYYY-MM-DD', but Drizzle
 * arranges that for its own statements only, and nothing changes it for the
 * process. Select it `::text` and the assertion reads the day as it is stored.
 *
 * No tests in here.
 */

import { Client } from "pg";

let connecting: Promise<Client> | null = null;

/** One connection per test file, opened by the first statement that needs it. */
function witness(): Promise<Client> {
  connecting ??= (async () => {
    // ./setup.ts has pointed DATABASE_URL at this file's own database.
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    return client;
  })();
  return connecting;
}

/** Close the connection. ./setup.ts calls it before it drops the database. */
export async function closeWitness(): Promise<void> {
  const client = await connecting?.catch(() => null);
  connecting = null;
  await client?.end();
}

/** Run one statement and answer its rows. */
export async function rows<T = Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const client = await witness();
  const result = await client.query(text, params as unknown[]);
  return result.rows as T[];
}

/** A table or column name of ours, quoted. Never a value: those are bound. */
function quoted(name: string): string {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`not a name: ${name}`);
  return `"${name}"`;
}

/**
 * Move one timestamp of one row into the past: `backdate("extraction_runs",
 * "started_at", id, "3 minutes")`. The database's clock cannot be faked, so a
 * test that needs something to be old makes it old.
 */
export async function backdate(
  table: string,
  column: string,
  id: string,
  interval: string,
): Promise<void> {
  await rows(
    `UPDATE ${quoted(table)} SET ${quoted(column)} = ${quoted(column)} - $2::interval WHERE id = $1`,
    [id, interval],
  );
}

/**
 * Every row of every table, as PostgreSQL prints it, in a fixed order. Two
 * snapshots that are equal mean nothing was written in between.
 */
export async function snapshot(): Promise<Record<string, unknown[]>> {
  const tables = await rows<{ name: string }>(
    `SELECT table_name AS name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );

  const everything: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    const stored = await rows<{ stored: unknown }>(
      `SELECT to_jsonb(t) AS stored FROM ${quoted(name)} t ORDER BY t.id`,
    );
    everything[name] = stored.map((row) => row.stored);
  }
  return everything;
}
