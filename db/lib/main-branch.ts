// KAN-86: how this checkout's db/migrations differs from main's.

/**
 * What main has, and what this checkout changed.
 *
 * A migration that is on main is history: some database has applied it, and
 * will never look at it again. So several scripts need the same answer, which
 * migration files here are new and which are main's: `db/check-migrations.ts`
 * to refuse an edit to main's, `db/rehearse.ts` to try the new ones on a
 * database built as main has it, `db/notice.ts` to read the new ones for the
 * pull request's comment.
 *
 * "main" is `origin/main` as this checkout last fetched it. Nothing here
 * fetches: a commit hook has to work with no network. CI fetches first.
 *
 * Nothing here is run directly. Relative imports, like every script.
 */

import { execFileSync } from "node:child_process";

import type { MigrationFileChange } from "./migration-rules";

/** The branch every pull request merges into, as this checkout last saw it. */
export const MAIN = "origin/main";

/** Where the generated migrations are, from the repository root. */
export const MIGRATIONS_PATH = "db/migrations";

function git(args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Whether this checkout knows what main holds. A shallow clone that fetched only its own branch does not. */
export function mainIsKnown(): boolean {
  try {
    git(["rev-parse", "--verify", "--quiet", `${MAIN}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** What to say, and stop, when main is not known. */
export function requireMain(): void {
  if (mainIsKnown()) return;
  console.error(
    `This check compares ${MIGRATIONS_PATH} with main, and ${MAIN} is not known in this checkout.\n\n` +
      "Run this, then try again:\n\n" +
      "  git fetch origin main",
  );
  process.exit(1);
}

/**
 * Whether this branch already holds everything main has: main is merged into
 * it, or is being merged into it right now. A merge that stopped on a conflict
 * counts, because the schema files main changed are already in the working
 * tree.
 */
export function mainIsMergedIn(): boolean {
  const main = git(["rev-parse", MAIN]).trim();
  try {
    git(["merge-base", "--is-ancestor", main, "HEAD"]);
    return true;
  } catch {
    try {
      const merging = git(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"]);
      return merging.trim() === main;
    } catch {
      return false;
    }
  }
}

/**
 * Every file under db/migrations that differs from main's, as the files are on
 * disk now: committed, staged or neither. A file git has not been told about
 * yet counts as added, because a migration that was just generated is exactly
 * that.
 */
export function migrationChanges(): MigrationFileChange[] {
  const tracked = git([
    "diff",
    "--name-status",
    "--no-renames",
    MAIN,
    "--",
    MIGRATIONS_PATH,
  ])
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [status, path] = line.split("\t");
      return { status: status[0] as MigrationFileChange["status"], path };
    });

  const untracked = git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    MIGRATIONS_PATH,
  ])
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((path) => ({ status: "A" as const, path }));

  return [...tracked, ...untracked];
}

/** The .sql files that are only here: the migrations this branch adds. */
export function newMigrations(): string[] {
  return migrationChanges()
    .filter((change) => change.status === "A" && change.path.endsWith(".sql"))
    .map((change) => change.path)
    .sort();
}
