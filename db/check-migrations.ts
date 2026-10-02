// KAN-86: three things about db/migrations that are wrong before any database is asked.

/**
 * Check this branch's migrations against main's, with no database.
 *
 * It is the second half of `npm run db:check` (the first is
 * tests/migrations.test.ts, which asks whether the schema files and the newest
 * migration agree). The commit hook runs both when a commit touches the schema
 * files or the migrations, and CI runs both on every pull request.
 *
 * 1. main gained a migration while this branch was open, so both wrote "the
 *    next migration". This branch's has to be written again on top of main's,
 *    after main is merged in.
 * 2. A migration that is on main was changed. Databases that already applied
 *    it never look at it again, so the edit reaches some databases and not
 *    others, and nothing reports the difference. Deleting one is allowed: that
 *    is what reverting a pull request does.
 * 3. A new migration adds a column that every existing row would need a value
 *    for, and gives none. It works on the empty databases the tests build and
 *    fails on one that holds rows.
 *
 * The first two both show up as "a file under db/migrations differs from
 * main's" and need opposite remedies; db/lib/migration-rules.ts tells them
 * apart. Whoever reads the message is usually a coding agent, so each message
 * says what is wrong, where, and the commands that put it right.
 *
 *   npm run db:check
 */

import { existsSync, readFileSync } from "node:fs";

import {
  MAIN,
  migrationChanges,
  newMigrations,
  requireMain,
} from "./lib/main-branch";
import {
  hasConflictMarkers,
  readChanges,
  requiredColumnsWithoutDefault,
} from "./lib/migration-rules";

const RULES =
  'The rules, and the reason for each: src/server/db/AGENTS.md, "How the database changes".';

/**
 * On GitHub, also say it where a person looks first: one line under
 * "Annotations" on the run's page and on the file in the pull request. The
 * full message, with the commands, is in the log either way.
 */
function annotate(path: string, summary: string): void {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  console.log(`::error file=${path},title=Migration check::${summary}`);
}

requireMain();

const JOURNAL = "db/migrations/meta/_journal.json";

const { collided, edited } = readChanges(migrationChanges());
const conflictLeftInJournal =
  existsSync(JOURNAL) && hasConflictMarkers(readFileSync(JOURNAL, "utf8"));

// 1. Said first, and alone: every other finding about these files would
// follow from it, and their remedies would make it worse.
if (collided || conflictLeftInJournal) {
  annotate(
    JOURNAL,
    "main gained a migration while this branch was open. Fetch and merge origin/main, then npm run db:regenerate (the log has the commands).",
  );
  console.error(
    'main gained a migration while this branch was open, and both wrote "the next migration".\n\n' +
      "This branch's has to be written again on top of main's. Merge main first, so that the\n" +
      "schema files hold main's change as well as this branch's, then regenerate:\n\n" +
      "  git fetch origin main\n" +
      `  git merge ${MAIN}\n` +
      "  npm run db:regenerate -- --name=<what_changed>\n" +
      "  git commit          (when the merge stopped on a conflict and is still open)\n\n" +
      "The merge reports conflicts under db/migrations. Leave them: db:regenerate replaces\n" +
      "that folder with main's and writes this branch's migration after it. A conflict in a\n" +
      "schema file is solved by keeping both changes. meta/_journal.json is never merged by\n" +
      "hand: the migrator would skip this branch's migration on a database that already had\n" +
      "main's, and say nothing.\n\n" +
      RULES,
  );
  process.exit(1);
}

const problems: string[] = [];

// 2. main's migrations are as main has them.
for (const path of edited) {
  annotate(
    path,
    "This migration is already on main and was changed. Put it back and generate a new migration instead (the log has the commands).",
  );
  problems.push(
    `${path} is already on main, and this branch changed it.\n\n` +
      "A migration that has been merged is history: a database that already applied it\n" +
      "will never see the edit. Put the file back, change the schema file instead, and\n" +
      "let a new migration carry the change:\n\n" +
      `  git restore --source=${MAIN} --staged --worktree -- ${path}\n` +
      "  (edit the table under src/server/db/schema/)\n" +
      "  npm run db:generate -- --name=<what_changed>",
  );
}

// 3. A new migration must be able to run on a table that holds rows.
for (const path of newMigrations()) {
  for (const statement of requiredColumnsWithoutDefault(
    readFileSync(path, "utf8"),
  )) {
    annotate(
      path,
      "Adds a NOT NULL column with no default, which fails on a table that holds rows. Give it a default or leave it nullable, then npm run db:regenerate.",
    );
    problems.push(
      `${path} adds a column that is NOT NULL and has no default:\n\n` +
        `  ${statement}\n\n` +
        "PostgreSQL refuses this on a table that already holds rows, because the existing\n" +
        "rows would have no value for it. In the schema file, give the column a default\n" +
        "(.default(...)) or leave it nullable (remove .notNull()), then write the\n" +
        "migration again:\n\n" +
        "  npm run db:regenerate -- --name=<what_changed>",
    );
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n\n----\n\n"));
  console.error(`\n${RULES}`);
  process.exit(1);
}
