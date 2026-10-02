// KAN-86: the words a pull request is given when its migration removes or renames something.

/**
 * `npm run -s db:notice`
 *
 * Prints a warning block, in GitHub's markdown, when a migration this branch
 * adds drops a table or a column, renames one, or deletes rows. Prints nothing
 * when none does. The pull request workflow puts whatever this prints into the
 * comment it leaves on the pull request (.github/workflows/ci-cd.yml).
 *
 * It refuses nothing, on purpose. A check that went red on every DROP would
 * teach a coding agent never to remove anything, and whether data may go is a
 * person's decision anyway. The notice makes sure that person sees the
 * statement before approving: everything under db/ needs the code owner's
 * review (.github/CODEOWNERS).
 */

import { readFileSync } from "node:fs";

import { newMigrations, requireMain } from "./lib/main-branch";
import { destructiveStatements } from "./lib/migration-rules";

requireMain();

const found = newMigrations().flatMap((path) =>
  destructiveStatements(readFileSync(path, "utf8")).map((statement) => ({
    path,
    statement,
  })),
);

if (found.length > 0) {
  const lines = [
    "> [!WARNING]",
    "> **A migration in this pull request removes or renames something that holds data.** Only Jason decides when a table or a column goes: read each statement below before approving.",
    ">",
    ...found.map(
      ({ path, statement }) =>
        `> - \`${path}\`: \`${statement.replace(/\s+/g, " ")}\``,
    ),
  ];
  console.log(lines.join("\n"));
}
