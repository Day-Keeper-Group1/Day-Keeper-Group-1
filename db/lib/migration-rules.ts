// KAN-86: what can be read off a migration's SQL without a database.

/**
 * Two questions about the text of a generated migration.
 *
 * Both are asked of the SQL drizzle-kit wrote, statement by statement, with no
 * database: `db/check-migrations.ts` asks the first before a commit and in CI,
 * and `db/notice.ts` asks the second for the comment on a pull request. They
 * are here, apart from those scripts, so that tests/migration-rules.test.ts
 * can hold them to examples.
 *
 * Pure functions over a string. Nothing here reads a file or runs git.
 */

/** drizzle-kit ends each statement with this marker (`breakpoints`, on by default). */
const BREAKPOINT = "--> statement-breakpoint";

/** The statements of one migration file, trimmed, in order. */
export function statementsOf(sql: string): string[] {
  return sql
    .split(BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * The statements that add a column every existing row would have to have a
 * value for, and give it none: `ADD COLUMN ... NOT NULL` with no `DEFAULT`.
 *
 * PostgreSQL refuses such a statement on a table that holds rows, and accepts
 * it on an empty one. The tests build their databases empty, and the rehearsal
 * (db/rehearse.ts) only has rows in the tables the seed writes to, so a table
 * like `sessions` would pass both and fail on the deployed database. The text
 * of the statement says it either way.
 *
 * A generated column is left alone: it is NOT NULL-safe by construction,
 * because PostgreSQL computes it for every existing row.
 */
export function requiredColumnsWithoutDefault(sql: string): string[] {
  return statementsOf(sql).filter(
    (statement) =>
      /\bADD COLUMN\b/i.test(statement) &&
      /\bNOT NULL\b/i.test(statement) &&
      !/\bDEFAULT\b/i.test(statement) &&
      !/\bGENERATED\b/i.test(statement),
  );
}

/**
 * The statements that remove or rename something that holds data: a dropped
 * table or column, a rename, a TRUNCATE or a DELETE.
 *
 * None of these is refused. A person decides whether data may go, so the pull
 * request is given a notice that puts each of these statements in front of
 * whoever approves it (db/notice.ts). Dropping a constraint or an index
 * removes no data and is not listed.
 */
export function destructiveStatements(sql: string): string[] {
  return statementsOf(sql).filter(
    (statement) =>
      /\bDROP (TABLE|COLUMN)\b/i.test(statement) ||
      /\bRENAME (COLUMN|TO)\b/i.test(statement) ||
      /^\s*(TRUNCATE|DELETE FROM)\b/i.test(statement),
  );
}
