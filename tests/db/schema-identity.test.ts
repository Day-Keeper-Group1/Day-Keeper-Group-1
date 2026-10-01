// KAN-92: the database the migrations build is the database db/schema.sql built. Temporary.

/**
 * Two databases, compared catalog by catalog.
 *
 * One is built here from db/schema.sql, the file that has defined the database
 * until now. The other is this file's own test database, a copy of the one the
 * migrator built from db/migrations. KAN-92 changes how the database is
 * defined and promises not to change the database, and this is the promise
 * checked: the same enums with their labels in the same order, the same
 * columns in the same positions with the same types, defaults and
 * nullability, the same constraints and indexes under the same names with the
 * same definitions, the same view.
 *
 * Three things are taken out of the old side first, because the change removes
 * them on purpose: the three triggers that kept updated_at, the function they
 * called, and the pgcrypto extension (gen_random_uuid() has been built into
 * PostgreSQL since version 13). updated_at is now set by the schema's own
 * column definition, src/server/db/schema/columns.ts.
 *
 * This file is deleted in the same commit as db/schema.sql: with nothing left
 * to compare against, tests/db/schema.test.ts and tests/migrations.test.ts
 * carry on from there.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDb } from "@/server/db/client";
import {
  createEmpty,
  dropDatabase,
  fileDatabaseName,
  withDatabase,
} from "./support/databases";
import { rows } from "./support/witness";

const adminUrl = inject("dkTestAdminUrl");
/** Named like every database of this run, so the run's own teardown would catch it too. */
const oldDatabase = fileDatabaseName(inject("dkTestTemplate"));

/** A connection to the database built from db/schema.sql. */
let old: Client;

beforeAll(async () => {
  const admin = createDb(adminUrl, { max: 1 });
  try {
    await createEmpty(admin.db, oldDatabase);
  } finally {
    await admin.pool.end();
  }

  old = new Client({ connectionString: withDatabase(adminUrl, oldDatabase) });
  await old.connect();
  // The whole file in one message, which is how db/reset.ts sends it.
  await old.query(
    readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8"),
  );
  await old.query(`
    DROP TRIGGER users_touch ON users;
    DROP TRIGGER documents_touch ON documents;
    DROP TRIGGER tasks_touch ON tasks;
    DROP FUNCTION touch_updated_at();
    DROP EXTENSION pgcrypto;
  `);
});

afterAll(async () => {
  await old?.end();
  const admin = createDb(adminUrl, { max: 1 });
  try {
    await dropDatabase(admin.db, oldDatabase);
  } finally {
    await admin.pool.end();
  }
});

/** What to ask both databases. Each answer is ordered, so equal means identical. */
const CATALOGS: Array<{ what: string; query: string }> = [
  {
    what: "the enums, with their labels in order",
    query: `
      SELECT t.typname AS name,
             array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
       GROUP BY t.typname
       ORDER BY t.typname`,
  },
  {
    what: "every column of every table and of the view: position, type, nullability, default, generated",
    query: `
      SELECT c.relname AS relation,
             a.attnum AS position,
             a.attname AS name,
             format_type(a.atttypid, a.atttypmod) AS type,
             a.attnotnull AS not_null,
             pg_get_expr(d.adbin, d.adrelid) AS default_or_generation,
             a.attgenerated::text AS generated
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'v')
         AND a.attnum > 0
         AND NOT a.attisdropped
       ORDER BY c.relname, a.attnum`,
  },
  {
    what: "every constraint: name, kind, definition",
    query: `
      SELECT c.relname AS relation,
             con.conname AS name,
             con.contype::text AS kind,
             pg_get_constraintdef(con.oid) AS definition
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = con.connamespace
       WHERE n.nspname = 'public'
       ORDER BY c.relname, con.conname`,
  },
  {
    what: "every index: name, definition",
    query: `
      SELECT tablename AS relation, indexname AS name, indexdef AS definition
        FROM pg_indexes
       WHERE schemaname = 'public'
       ORDER BY tablename, indexname`,
  },
  {
    what: "the view's definition",
    query: `
      SELECT viewname AS name, definition
        FROM pg_views
       WHERE schemaname = 'public'
       ORDER BY viewname`,
  },
  {
    what: "no trigger, no function and no extension beyond PostgreSQL's own",
    query: `
      SELECT 'trigger' AS kind, tgname::text AS name
        FROM pg_trigger WHERE NOT tgisinternal
      UNION ALL
      SELECT 'function', p.proname::text
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'extension', extname::text
        FROM pg_extension WHERE extname <> 'plpgsql'
       ORDER BY 1, 2`,
  },
];

describe("the database from db/migrations and the database from db/schema.sql", () => {
  it.each(CATALOGS)("agree on $what", async ({ query }) => {
    const fromSchemaSql = (await old.query(query)).rows;
    const fromMigrations = await rows(query);

    expect(fromMigrations).toEqual(fromSchemaSql);
  });

  it("were both really looked at: eleven tables, one view, 106 columns in the tables", async () => {
    const shape = `
      SELECT (SELECT count(*)::integer FROM pg_tables WHERE schemaname = 'public') AS tables,
             (SELECT count(*)::integer FROM pg_views WHERE schemaname = 'public') AS views,
             (SELECT count(*)::integer
                FROM information_schema.columns c
                JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
               WHERE c.table_schema = 'public') AS columns`;

    const expected = [{ tables: 11, views: 1, columns: 106 }];
    expect((await old.query(shape)).rows).toEqual(expected);
    expect(await rows(shape)).toEqual(expected);
  });
});
