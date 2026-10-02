// KAN-86: the two questions asked of a migration's SQL, held to examples.

/**
 * db/lib/migration-rules.ts reads the text drizzle-kit generates. These are
 * statements in exactly the form drizzle-kit 0.31 writes them, so a change in
 * that form shows up here and not on a pull request that slipped through.
 */

import { describe, expect, it } from "vitest";

import {
  destructiveStatements,
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
