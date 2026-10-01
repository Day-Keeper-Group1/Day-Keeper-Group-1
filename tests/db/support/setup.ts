// KAN-92: once per test file: a database of its own, and every table emptied before each test.

/**
 * What every file under tests/db starts from.
 *
 * Before the file's first test, the template the run built (./global-setup.ts)
 * is copied into a database only this file uses, and DATABASE_URL is pointed
 * at it, so the app's own handle, `db()`, connects there the first time
 * anything calls it. Files therefore run side by side, and none of them can
 * see the database a developer works in.
 *
 * Before each test every table is emptied. A test starts from nothing and
 * builds the world it needs (./world.ts), which also means rows made in a
 * `beforeAll` are gone by the first test: build them in a `beforeEach`.
 *
 * After the last test the connections are closed and the database is dropped.
 *
 * This file imports nothing from src/server except db/client.ts and db/schema
 * (through db/lib/admin.ts). It runs before the test file does, and a module it
 * had already loaded would be the real one by the time the test file's
 * `vi.mock` asked for a replacement.
 */

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

import { truncateAll } from "../../../db/lib/admin";
import { createDb } from "@/server/db/client";
import {
  createFromTemplate,
  dropDatabase,
  fileDatabaseName,
  withDatabase,
} from "./databases";
import { closeWitness } from "./witness";

type Handle = { db: NodePgDatabase; pool: Pool };

const adminUrl = inject("dkTestAdminUrl");
const template = inject("dkTestTemplate");
const database = fileDatabaseName(template);
const url = withDatabase(adminUrl, database);

// Set here, while the file is still being loaded, and not in a hook: env()
// reads the variable once, on its first call, and that has to find this.
process.env.DATABASE_URL = url;

/**
 * This file's own connection, for emptying the tables. Not the app's. Not
 * there until the database it connects to has been made.
 */
let own: Handle | undefined;

/** Send one statement from the configured database, which is where databases are made and dropped from. */
async function fromAdmin(
  statement: (admin: NodePgDatabase) => Promise<void>,
): Promise<void> {
  const admin = createDb(adminUrl, { max: 1 });
  try {
    await statement(admin.db);
  } finally {
    await admin.pool.end();
  }
}

beforeAll(async () => {
  await fromAdmin((admin) => createFromTemplate(admin, database, template));
  own = createDb(url, { max: 1 });
});

beforeEach(async () => {
  // No test runs when beforeAll failed, so the connection is there.
  const { db } = own!;

  // TRUNCATE is about to run. Ask the connection where it is, every time,
  // rather than trust that the name above was put together correctly.
  const where = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  if (!where.rows[0].name.startsWith("dk_test_")) {
    throw new Error(
      `Refusing to empty ${where.rows[0].name}: it is not a test database.`,
    );
  }
  await truncateAll(db);
});

afterAll(async () => {
  // The app's pool, if a test made the app connect. Ended and forgotten, so
  // nothing is left connected to a database that is about to go.
  const app = globalThis as unknown as { __daykeeperDb?: Handle };
  await app.__daykeeperDb?.pool.end();
  delete app.__daykeeperDb;

  await closeWitness();
  // This runs even when beforeAll failed before the database existed. Then
  // there is no connection to end, the drop finds nothing to drop, and the
  // failure reported is the one beforeAll threw, not a second one from here.
  await own?.pool.end();
  await fromAdmin((admin) => dropDatabase(admin, database));
});
