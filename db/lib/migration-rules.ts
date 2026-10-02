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

/** One file under db/migrations that differs from main's. */
export type MigrationFileChange = {
  /**
   * A: only here. M: on main, and different here. D: on main, and gone here.
   * U: git is in the middle of a merge and has both versions of the file.
   */
  status: "A" | "M" | "D" | "U";
  /** From the repository root, with forward slashes: db/migrations/0001_x.sql. */
  path: string;
};

/**
 * What the differences from main's db/migrations mean.
 *
 * Two different things leave a file "modified", and they need opposite
 * remedies, so they are told apart here.
 *
 * - `collided`: main gained a migration while this branch was open. Both wrote
 *   "the next migration", so this branch's snapshot with that number is not
 *   main's, and main's .sql with that number is missing here while this branch
 *   has one of its own. Nobody edits a snapshot by hand, so a modified
 *   snapshot is this and nothing else. The remedy is to merge main and write
 *   this branch's migration again. Putting main's files back and generating
 *   from schema files that have not met main's change would write a migration
 *   that drops what main just added.
 * - `edited`: a .sql file that is on main was changed here. The remedy is to
 *   put it back.
 *
 * When the branch collided, nothing is reported as edited: the same files show
 * up as modified for that reason alone.
 */
export function readChanges(changes: MigrationFileChange[]): {
  collided: boolean;
  edited: string[];
} {
  const isSql = (change: MigrationFileChange) => change.path.endsWith(".sql");
  const isSnapshot = (change: MigrationFileChange) =>
    /_snapshot\.json$/.test(change.path);
  const has = (
    status: MigrationFileChange["status"],
    test: (change: MigrationFileChange) => boolean,
  ) => changes.some((change) => change.status === status && test(change));

  const collided =
    has("M", isSnapshot) ||
    (has("D", isSql) && has("A", isSql)) ||
    // A merge that stopped on these files is the same collision, seen by git.
    has("U", () => true);

  return {
    collided,
    edited: collided
      ? []
      : changes
          .filter((change) => change.status === "M" && isSql(change))
          .map((change) => change.path),
  };
}
