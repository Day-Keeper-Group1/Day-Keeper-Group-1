// KAN-86: write the next migration, and say so plainly when it could not be written.

/**
 * `npm run db:generate -- --name=<what_changed>`
 *
 * drizzle-kit compares the schema files with the newest snapshot and writes
 * the difference as the next migration. This script runs it and then checks
 * what it left behind, for one reason: drizzle-kit can fail and report
 * success.
 *
 * When a column or a table might have been renamed, drizzle-kit asks whether
 * it was renamed or dropped and made again. With no terminal to ask in (a
 * coding agent's shell, CI) it prints one line, writes nothing, and exits 0.
 * Whoever ran it believes the migration exists. So the output is read here,
 * and that case ends with exit 1 and the way to do a rename that needs no
 * question answered.
 *
 * After a migration is written, the same checks a commit and CI would run are
 * run straight away, so a problem is met here, in the same breath, and not a
 * push later:
 *
 * - `npm run db:check`: the schema files and the migrations agree, and no
 *   migration that is on main was touched.
 * - `npm run db:rehearse`: the new migration applies to a database that
 *   already holds rows. Skipped with a note when no local PostgreSQL answers;
 *   CI always runs it.
 *
 * Every argument is handed to drizzle-kit as it is (`--name`, `--custom`).
 * In a real terminal drizzle-kit keeps the screen, so a person can still
 * answer its question there.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const KIT = resolve(process.cwd(), "node_modules/drizzle-kit/bin.cjs");
const NO_TERMINAL = /Interactive prompts require a TTY/i;

const RENAME_RECIPE = `drizzle-kit wrote nothing. The change looks like a rename, and it has to ask
whether something was renamed or dropped and made again. There is no terminal
here to ask in.

A rename that needs no question, as three migrations in one pull request:

  1. In the schema file, add the new column beside the old one. Leave it
     nullable for now, even if it will be NOT NULL in the end.
       npm run db:generate -- --name=add_<new_column>

  2. An empty migration for the copy:
       npm run db:generate -- --custom --name=copy_<old_column>_to_<new_column>
     and in the .sql file it creates, write:
       UPDATE "<table>" SET "<new_column>" = "<old_column>";

  3. In the schema file, remove the old column (and add .notNull() to the new
     one if it needs it).
       npm run db:generate -- --name=drop_<old_column>

src/server/db/AGENTS.md, "How the database changes", has the reasons.`;

const args = process.argv.slice(2);
const atATerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const kit = spawnSync(process.execPath, [KIT, "generate", ...args], {
  encoding: "utf8",
  // At a terminal drizzle-kit owns the screen, so its question can be seen and
  // answered. Anywhere else its output is collected, to be read below.
  stdio: atATerminal ? "inherit" : ["ignore", "pipe", "pipe"],
});

if (!atATerminal) {
  process.stdout.write(kit.stdout ?? "");
  process.stderr.write(kit.stderr ?? "");
  if (NO_TERMINAL.test(`${kit.stdout}${kit.stderr}`)) {
    console.error(`\n${RENAME_RECIPE}`);
    process.exit(1);
  }
}
if (kit.status !== 0) process.exit(kit.status ?? 1);

/**
 * Run one of this project's npm scripts, and stop here if it fails. One
 * string for the shell, which is how npm is found on Windows.
 */
function npmRun(script: string, flag = ""): void {
  const done = spawnSync(`npm run -s ${script}${flag ? ` -- ${flag}` : ""}`, {
    stdio: "inherit",
    shell: true,
  });
  if (done.status !== 0) process.exit(done.status ?? 1);
}

npmRun("db:check");
npmRun("db:rehearse", "--if-database-answers");
