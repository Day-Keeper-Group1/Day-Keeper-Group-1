// KAN-86: the two questions asked of a migration's SQL, held to examples.

/**
 * db/lib/migration-rules.ts reads the text drizzle-kit generates. These are
 * statements in exactly the form drizzle-kit 0.31 writes them, so a change in
 * that form shows up here and not on a pull request that slipped through.
 */

import { describe, expect, it } from "vitest";

import {
  destructiveStatements,
  hasConflictMarkers,
  readChanges,
  requiredColumnsWithoutDefault,
  statementsOf,
} from "../db/lib/migration-rules";

const BREAK = "--> statement-breakpoint\n";

describe("the statements of a migration", () => {
  it("are split at drizzle-kit's marker, in order, with nothing empty", () => {
    expect(
      statementsOf(
        `CREATE TYPE "public"."mood" AS ENUM('calm');${BREAK}ALTER TABLE "tasks" ADD COLUMN "note" text;\n`,
      ),
    ).toEqual([
      `CREATE TYPE "public"."mood" AS ENUM('calm');`,
      `ALTER TABLE "tasks" ADD COLUMN "note" text;`,
    ]);
  });
});

describe("a column every existing row would need a value for", () => {
  it("is found when it is NOT NULL and has no default", () => {
    const required = `ALTER TABLE "tasks" ADD COLUMN "priority" integer NOT NULL;`;
    expect(
      requiredColumnsWithoutDefault(
        `ALTER TABLE "tasks" ADD COLUMN "note" text;${BREAK}${required}`,
      ),
    ).toEqual([required]);
  });

  it("is fine with a default, when nullable, and when PostgreSQL computes it", () => {
    expect(
      requiredColumnsWithoutDefault(
        [
          `ALTER TABLE "tasks" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;`,
          `ALTER TABLE "tasks" ADD COLUMN "note" text;`,
          `ALTER TABLE "users" ADD COLUMN "name_lower" text GENERATED ALWAYS AS (lower(display_name)) STORED NOT NULL;`,
        ].join(BREAK),
      ),
    ).toEqual([]);
  });

  it("is not looked for in a table that is being created, which has no rows yet", () => {
    expect(
      requiredColumnsWithoutDefault(
        `CREATE TABLE "notes" (\n\t"id" uuid PRIMARY KEY NOT NULL,\n\t"body" text NOT NULL\n);`,
      ),
    ).toEqual([]);
  });
});

describe("a statement that removes or renames something that holds data", () => {
  it("is a dropped column or table, a rename, a TRUNCATE or a DELETE", () => {
    const destructive = [
      `ALTER TABLE "tasks" DROP COLUMN "due_time";`,
      `DROP TABLE "reminders" CASCADE;`,
      `ALTER TABLE "tasks" RENAME COLUMN "title" TO "name";`,
      `ALTER TABLE "tasks" RENAME TO "jobs";`,
      `TRUNCATE "audit_logs";`,
      `DELETE FROM "sessions" WHERE expires_at < now();`,
    ];
    expect(destructiveStatements(destructive.join(BREAK))).toEqual(destructive);
  });

  it("is not a dropped constraint or index, an added column, or an UPDATE", () => {
    expect(
      destructiveStatements(
        [
          `ALTER TABLE "tasks" DROP CONSTRAINT "tasks_title_present";`,
          `DROP INDEX "tasks_user_idx";`,
          `ALTER TABLE "tasks" ADD COLUMN "note" text;`,
          `UPDATE "tasks" SET "note" = "title";`,
        ].join(BREAK),
      ),
    ).toEqual([]);
  });
});

describe("what the differences from main's migrations mean", () => {
  const change = (status: "A" | "M" | "D" | "U", path: string) => ({
    status,
    path: `db/migrations/${path}`,
  });

  it("is nothing to report when the branch only adds a migration", () => {
    expect(
      readChanges([
        change("A", "0001_add_note.sql"),
        change("A", "meta/0001_snapshot.json"),
        change("M", "meta/_journal.json"),
      ]),
    ).toEqual({ collided: false, edited: [] });
  });

  it("is an edit when a .sql that is on main was changed", () => {
    expect(readChanges([change("M", "0000_initial_schema.sql")])).toEqual({
      collided: false,
      edited: ["db/migrations/0000_initial_schema.sql"],
    });
  });

  it("is a collision, and not an edit, when main and the branch each wrote the next migration", () => {
    // What a branch cut before main's 0001 looks like against main.
    expect(
      readChanges([
        change("D", "0001_add_foo.sql"),
        change("A", "0001_add_bar.sql"),
        change("M", "meta/0001_snapshot.json"),
        change("M", "meta/_journal.json"),
      ]),
    ).toEqual({ collided: true, edited: [] });
  });

  it("is a collision while git is in the middle of merging those files", () => {
    expect(
      readChanges([
        change("U", "meta/_journal.json"),
        change("U", "meta/0001_snapshot.json"),
      ]),
    ).toEqual({ collided: true, edited: [] });
  });

  it("is nothing to report when the branch is only behind main", () => {
    // main's newer migration is missing here, and this branch adds none.
    expect(
      readChanges([
        change("D", "0001_add_foo.sql"),
        change("D", "meta/0001_snapshot.json"),
        change("M", "meta/_journal.json"),
      ]),
    ).toEqual({ collided: false, edited: [] });
  });

  it("allows a merged migration to be removed, which is what a revert does", () => {
    expect(
      readChanges([
        change("D", "0003_drop_due_time.sql"),
        change("D", "meta/0003_snapshot.json"),
        change("M", "meta/_journal.json"),
      ]),
    ).toEqual({ collided: false, edited: [] });
  });
});

describe("a journal a merge left in conflict", () => {
  it("is recognised by the markers git wrote into it", () => {
    expect(
      hasConflictMarkers(
        [
          `{ "entries": [`,
          `<<<<<<< HEAD`,
          `    { "idx": 1, "tag": "0001_add_nickname" }`,
          `=======`,
          `    { "idx": 1, "tag": "0001_add_task_note" }`,
          `>>>>>>> origin/main`,
          `] }`,
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("is not seen in a journal that is whole", () => {
    expect(
      hasConflictMarkers(
        `{ "entries": [{ "idx": 0, "tag": "0000_initial_schema" }] }`,
      ),
    ).toBe(false);
  });
});
