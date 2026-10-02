// KAN-86: try this branch's new migrations on a database that already holds rows.

/**
 * `npm run db:rehearse`
 *
 * The tests build every database from nothing, so they prove a migration runs
 * on empty tables. The deployed database is not empty. A column added as NOT
 * NULL, a type that the existing values cannot be cast to, a unique constraint
 * the existing rows break: each of those passes every test and fails on the
 * first database that has rows in it. This is the rehearsal that meets rows
 * before the merge.
 *
 * What it does, on a scratch database of its own beside yours:
 *
 * 1. builds the database as main has it, from main's migrations;
 * 2. fills it with the seed's rows, written by main's own seed code, because
 *    this branch's seed already writes the columns the new migration adds;
 * 3. applies this branch's new migrations on top.
 *
 * Step 3 failing is the finding. PostgreSQL's own words are printed, with what
 * usually causes it and the command that writes the migration again.
 *
 * A branch that adds no migration has nothing to rehearse, and this says so
 * and stops before it touches anything.
 *
 * It is only as good as the rows it meets. The seed writes to nine of the
 * eleven tables; the ones it leaves empty are named at the end of a run. For
 * those, db/check-migrations.ts reads the SQL itself.
 *
 * main's files are unpacked into .rehearse/ at the repository root, which git
 * ignores. It has to be inside the repository, so that `drizzle-orm` and `tsx`
 * resolve from it, and outside node_modules, where tsx stops reading the "@/"
 * paths of tsconfig.json. The scratch database and that folder are removed
 * afterwards. Your own database is only where CREATE
 * DATABASE and DROP DATABASE are sent from.
 *
 * `--if-database-answers` turns "no PostgreSQL here" from a failure into a
 * note. `npm run db:generate` passes it, so generating a migration works on a
 * machine with Docker stopped; CI runs the rehearsal without it.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

import { hostIsLocal } from "../src/lib/local-host";
import { dbCause } from "../src/server/db/errors";
import * as schema from "../src/server/db/schema";
import { applyMigrations } from "./lib/admin";
import { connect, databaseUrl, loadEnv, maskedUrl } from "./lib/connect";
import { MAIN, newMigrations, requireMain } from "./lib/main-branch";

const lenient = process.argv.includes("--if-database-answers");

loadEnv();
const url = databaseUrl();

if (!hostIsLocal(url)) {
  console.error(
    "The rehearsal makes and drops a scratch database, so it only runs against a local PostgreSQL.\n\n" +
      `  DATABASE_URL: ${maskedUrl(url)}`,
  );
  process.exit(1);
}

requireMain();
const added = newMigrations();
if (added.length === 0) {
  console.log("No new migration on this branch: nothing to rehearse.");
  process.exit(0);
}

/** A scratch database named after yours, so two checkouts never share one. */
const scratchName = `dk_rehearse_${createHash("sha1")
  .update(new URL(url).pathname)
  .digest("hex")
  .slice(0, 8)}`;
const scratchUrl = (() => {
  const scratch = new URL(url);
  scratch.pathname = `/${scratchName}`;
  return scratch.toString();
})();

const BASE = resolve(process.cwd(), ".rehearse");

/**
 * main's database code and migrations, unpacked into BASE. The photographs
 * under data/ come out as the small pointer files git stores, which is all the
 * seed needs here: it lists them and never opens one.
 */
function unpackMain(): void {
  rmSync(BASE, { recursive: true, force: true });
  mkdirSync(BASE, { recursive: true });
  // git is run from the repository root, where "db" and "src" mean something,
  // and told the archive's full path. tar is run inside BASE and given the
  // bare file name, because a Windows path with a drive letter means "another
  // machine" to the tar that Git Bash ships.
  const archive = spawnSync(
    "git",
    [
      "archive",
      "--format=tar",
      "-o",
      resolve(BASE, "main.tar"),
      MAIN,
      "db",
      "src",
      "data/synthetic-letters",
      "tsconfig.json",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" },
    },
  );
  const unpack =
    archive.status === 0
      ? spawnSync("tar", ["-xf", "main.tar"], { cwd: BASE, stdio: "inherit" })
      : archive;
  if (unpack.status !== 0) {
    console.error(`Could not unpack ${MAIN} to rehearse on.`);
    process.exit(1);
  }
}

/** What main's own code does to an empty database: its migrations, then its seed. */
const BUILD_AS_MAIN = `
(async () => {
  const { connect } = await import("./db/lib/connect.ts");
  const { applyMigrations } = await import("./db/lib/admin.ts");
  const { seedWorld } = await import("./db/lib/seed-world.ts");
  const { db, pool } = connect(process.env.DATABASE_URL);
  try {
    await applyMigrations(db);
    await seedWorld(db, async () => 1234);
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(error && error.cause ? error.cause : error);
  process.exit(1);
});
`;

async function main(): Promise<number> {
  const admin = connect(url);
  try {
    await admin.db.execute(sql`select 1`);
  } catch (error) {
    await admin.pool.end().catch(() => {});
    const cause = dbCause(error) as { code?: string };
    if (lenient && cause.code === "ECONNREFUSED") {
      console.log(
        `Skipped the rehearsal: no PostgreSQL answered at ${maskedUrl(url)}. ` +
          "Start it with `docker compose up -d` and run `npm run db:rehearse`, or let CI run it.",
      );
      return 0;
    }
    console.error(
      `The rehearsal needs PostgreSQL, and ${maskedUrl(url)} did not answer.\n\n` +
        "Start it with: docker compose up -d",
    );
    console.error(cause);
    return 1;
  }

  const scratch = sql.identifier(scratchName);
  try {
    await admin.db.execute(
      sql`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`,
    );
    await admin.db.execute(sql`CREATE DATABASE ${scratch}`);

    // 1 and 2: the database as main has it, with rows.
    unpackMain();
    const asMain = spawnSync(
      process.execPath,
      ["--import", "tsx", "-e", BUILD_AS_MAIN],
      {
        cwd: BASE,
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: scratchUrl },
      },
    );
    if (asMain.status !== 0) {
      console.error(
        `\nCould not build a database as ${MAIN} has it, so nothing was rehearsed.\n` +
          "This is a fault in the rehearsal or in main, not in this branch's migration.",
      );
      return 1;
    }

    // 3: this branch's new migrations, on top of those rows.
    const { db, pool } = connect(scratchUrl);
    try {
      const empty: string[] = [];
      for (const table of Object.values(schema)) {
        if (!is(table, PgTable)) continue;
        const name = getTableName(table);
        // A table this branch adds is not there yet, and so holds nothing.
        const present = await db.execute<{ present: boolean }>(
          sql`select to_regclass(${`public.${name}`}) is not null as present`,
        );
        if (!present.rows[0].present) continue;
        const rows = await db.execute<{ n: number }>(
          sql`select count(*)::integer as n from ${sql.identifier(name)}`,
        );
        if (rows.rows[0].n === 0) empty.push(name);
      }

      let applied: number;
      try {
        applied = await applyMigrations(db);
      } catch (error) {
        const cause = dbCause(error) as {
          message?: string;
          detail?: string;
          table?: string;
          column?: string;
          constraint?: string;
        };
        console.error(
          "This branch's new migration cannot be applied to a database that already holds rows.\n\n" +
            `  ${cause.message ?? String(cause)}\n` +
            (cause.detail ? `  ${cause.detail}\n` : "") +
            (cause.table ? `  table: ${cause.table}\n` : "") +
            (cause.column ? `  column: ${cause.column}\n` : "") +
            (cause.constraint ? `  constraint: ${cause.constraint}\n` : "") +
            "\nNew on this branch:\n" +
            added.map((path) => `  ${path}`).join("\n") +
            "\n\nThe rehearsal built a database as main has it, filled it with the seed's rows, and\n" +
            "applied the migrations above. They run on an empty database (the tests prove that)\n" +
            "and not on one with data. The usual causes:\n\n" +
            "  - a column added as NOT NULL with no default: give it .default(...) or leave it nullable;\n" +
            "  - NOT NULL put on a column that holds nulls: fill the nulls first, in a migration made\n" +
            "    with `npm run db:generate -- --custom`, before the one that adds NOT NULL;\n" +
            "  - a column type the existing values cannot be cast to;\n" +
            "  - a unique constraint or a CHECK that the existing rows already break.\n\n" +
            "Correct the schema file under src/server/db/schema/, then write the migration again:\n\n" +
            "  npm run db:regenerate -- --name=<what_changed>",
        );
        return 1;
      }

      console.log(
        `Rehearsed: ${applied} new migration(s) applied to a database built as ${MAIN} has it, with the seed's rows in it.`,
      );
      if (empty.length > 0) {
        console.log(
          `The seed leaves these tables empty, so the rehearsal says nothing about them: ${empty.join(", ")}.`,
        );
      }
      return 0;
    } finally {
      await pool.end();
    }
  } finally {
    await admin.db
      .execute(sql`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
      .catch(() => {});
    await admin.pool.end();
    rmSync(BASE, { recursive: true, force: true });
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(dbCause(error));
    process.exit(1);
  });
