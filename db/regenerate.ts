// KAN-86: throw this branch's migrations away and write them again on top of main's.

/**
 * `npm run db:regenerate -- --name=<what_changed>`
 *
 * One command for the two cases where a branch's own migration has to be
 * written again:
 *
 * - main gained a migration while this branch was open. Both branches wrote
 *   "the next migration", so git reports a conflict in
 *   db/migrations/meta/_journal.json. Merging that file by hand looks fine and
 *   is not: the migrator runs only migrations dated later than the last one a
 *   database applied, so this branch's, dated earlier than main's, would be
 *   skipped without a word. Written again now, it is dated now.
 * - the migration this branch generated was wrong (a check refused it), and
 *   the schema file has been corrected.
 *
 * What it does: makes db/migrations exactly what main has, which removes every
 * migration this branch added, then runs `npm run db:generate` with the name
 * given. The schema files are not touched; they are what the new migration is
 * written from.
 *
 * It only ever removes files under db/migrations that main does not have, and
 * those are generated: nothing a person wrote is lost, with one exception. A
 * migration made with `--custom` holds hand-written SQL. Copy that SQL
 * somewhere first, and put it back with `npm run db:generate -- --custom`.
 *
 * A local database that applied the migration being thrown away keeps the
 * tables it made but has a record of a migration that no longer exists:
 * `npm run db:reset` afterwards.
 */

import { spawnSync } from "node:child_process";

import {
  MAIN,
  MIGRATIONS_PATH,
  mainIsMergedIn,
  requireMain,
} from "./lib/main-branch";

const args = process.argv.slice(2);
if (!args.some((arg) => arg.startsWith("--name"))) {
  console.error(
    "Say what the migration is called:\n\n" +
      "  npm run db:regenerate -- --name=<what_changed>",
  );
  process.exit(1);
}

/** Run a command with the screen, and stop here if it fails. */
function run(command: string, commandArgs: string[]): void {
  const done = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (done.status !== 0) process.exit(done.status ?? 1);
}

// Best effort: with no network, main as it was last fetched is used.
spawnSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "ignore" });
requireMain();

// The new migration is written from this branch's schema files against main's
// newest snapshot. If main's own schema change is not in those files yet, the
// difference reads as "remove what main added", and that is what would be
// written. So main has to be in this branch first.
if (!mainIsMergedIn()) {
  console.error(
    `This branch does not hold ${MAIN} yet. Merge it, then run this again:\n\n` +
      `  git merge ${MAIN}\n` +
      "  npm run db:regenerate -- --name=<what_changed>\n\n" +
      "Conflicts under db/migrations are expected and can be left: this command replaces\n" +
      "that folder with main's. A conflict in a schema file is solved by keeping both changes.",
  );
  process.exit(1);
}

// db/migrations as main has it: the files this branch changed are put back,
// and the ones it added are removed, whether git knows them yet or not.
run("git", [
  "restore",
  `--source=${MAIN}`,
  "--staged",
  "--worktree",
  "--",
  MIGRATIONS_PATH,
]);
run("git", ["clean", "-fdq", "--", MIGRATIONS_PATH]);
console.log(
  `${MIGRATIONS_PATH} is as ${MAIN} has it. Writing this branch's migration again.`,
);

// The generate script itself, with the same node and the same arguments, so
// that nothing has to be quoted for a shell on the way.
run(process.execPath, ["--import", "tsx", "db/generate.ts", ...args]);
