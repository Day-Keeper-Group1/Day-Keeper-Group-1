// KAN-92: the schema files and the migrations generated from them must agree.

/**
 * The database is declared in src/server/db/schema, and built from the
 * migrations under db/migrations, which `npm run db:generate` writes from
 * those declarations. Two things can go wrong between the two, and neither
 * shows on a laptop whose database is already built.
 *
 * Somebody edits a schema file and forgets to generate. Every type compiles,
 * every query is written against a column the migrations never create, and it
 * fails the first time the code meets a database built from scratch.
 *
 * Or the folder itself stops being a history. The migrator applies whatever
 * the journal lists, in the order of each entry's `when`, and skips an entry
 * older than the last one it applied without saying so. A hand-merged journal
 * or a stray file is therefore a migration that silently never runs.
 *
 * Both are checked here with no database and no network: drizzle-kit is asked
 * what it would generate next, and the answer has to be nothing. This is the
 * first half of `npm run db:check`; db/check-migrations.ts is the second.
 *
 * KAN-86: whoever reads a failure here is usually a coding agent, so each one
 * says what to run to put it right.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { describe, expect, it } from "vitest";

import * as schema from "@/server/db/schema";

const MIGRATIONS = resolve(__dirname, "..", "db/migrations");

type Journal = { entries: { idx: number; when: number; tag: string }[] };
type Snapshot = Parameters<typeof generateMigration>[0];

/** What to do when the schema files have moved on and no migration followed. */
const GENERATE = [
  "The schema files under src/server/db/schema/ describe a database that the migrations do not build.",
  "Write the migration for the change:",
  "",
  "  npm run db:generate -- --name=<what_changed>",
  "",
  "and commit the schema file together with the files it writes under db/migrations/.",
  "The statements below are what that migration would hold.",
].join("\n");

/** What to do when the folder is no longer one unbroken history. */
const REGENERATE = [
  "db/migrations is not one history in order. This is what a hand-merged meta/_journal.json",
  "looks like, or two branches that each wrote the next migration. The migrator would skip a",
  "migration here without saying so. Throw this branch's migrations away and write them again",
  "on top of main's:",
  "",
  "  git fetch origin main",
  "  git merge origin/main",
  "  npm run db:regenerate -- --name=<what_changed>",
].join("\n");

const journal = JSON.parse(
  readFileSync(resolve(MIGRATIONS, "meta/_journal.json"), "utf8"),
) as Journal;

/** drizzle-kit names a snapshot after its migration's number: 0003_snapshot.json. */
const snapshotPath = (idx: number) =>
  resolve(MIGRATIONS, "meta", `${String(idx).padStart(4, "0")}_snapshot.json`);

describe("the schema files and the newest migration", () => {
  it("describe the same database, so there is nothing left to generate", async () => {
    const newest = journal.entries[journal.entries.length - 1];
    const snapshot = JSON.parse(
      readFileSync(snapshotPath(newest.idx), "utf8"),
    ) as Snapshot;

    // What `npm run db:generate` would write now. A changed column, CHECK or
    // index predicate shows up as statements; a rename makes drizzle-kit ask a
    // question, which throws here because there is no terminal to answer in.
    let statements: string[];
    try {
      statements = await generateMigration(
        snapshot,
        generateDrizzleJson(schema, snapshot.id),
      );
    } catch (error) {
      throw new Error(
        [
          "The schema files changed in a way that looks like a rename, and drizzle-kit cannot write",
          "that migration without asking a question. Run:",
          "",
          "  npm run db:generate -- --name=<what_changed>",
          "",
          "It explains how to do a rename that needs no question.",
        ].join("\n"),
        { cause: error },
      );
    }

    expect(statements, GENERATE).toEqual([]);
  });
});

describe("the journal", () => {
  it("numbers its migrations from 0 with no gap", () => {
    expect(journal.entries.length).toBeGreaterThan(0);
    expect(
      journal.entries.map((entry) => entry.idx),
      REGENERATE,
    ).toEqual(journal.entries.map((_, position) => position));
  });

  it("dates each migration later than the one before it", () => {
    // The migrator runs only entries later than the last one it applied, so
    // an entry out of order is one it never runs.
    const whens = journal.entries.map((entry) => entry.when);
    for (let i = 1; i < whens.length; i++) {
      expect(whens[i], REGENERATE).toBeGreaterThan(whens[i - 1]);
    }
  });

  it("lists exactly the .sql files in the folder", () => {
    const files = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(files, REGENERATE).toEqual(
      journal.entries.map((entry) => `${entry.tag}.sql`).sort(),
    );
  });

  it("has a snapshot for every migration", () => {
    const missing = journal.entries
      .filter((entry) => !existsSync(snapshotPath(entry.idx)))
      .map((entry) => entry.tag);
    expect(missing, REGENERATE).toEqual([]);
  });
});
