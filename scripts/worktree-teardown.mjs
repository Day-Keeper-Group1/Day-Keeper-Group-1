// @ts-check
// worktree-teardown: retire this worktree's isolated resources.
//
// Drops this worktree's OWN database and bucket and clears its OWN port, and
// nothing else. The safety valve is structural: it refuses any database whose
// name does not start with `daykeeper_wt_` and any bucket that is not
// `daykeeper-wt-*`, so it is incapable of touching the shared main database or
// the shared main bucket no matter how it is invoked.
//
// KAN-92: it also drops the test databases `npm test` left beside this
// worktree's database, if a run was killed before it could drop them itself.
//
// Removing the worktree directory itself has to happen from another checkout
// (git will not remove the tree you are standing in); the closing message
// says exactly how.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { killByPort } from "./lib/port-utils.mjs";
import { testDatabasePrefix } from "./lib/worktree-naming.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const worktreeRoot = resolve(here, "..");

function die(humanReason, fixCommand) {
  console.error(`\nworktree-teardown stopped: ${humanReason}`);
  if (fixCommand) console.error(`  fix: ${fixCommand}`);
  console.error("");
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: worktreeRoot,
    encoding: "utf8",
  }).trim();
}

function isMainCheckout() {
  try {
    const gitDir = git(["rev-parse", "--absolute-git-dir"]);
    const commonDir = git(["rev-parse", "--git-common-dir"]);
    return resolve(gitDir) === resolve(worktreeRoot, commonDir);
  } catch {
    return false;
  }
}

/** Send one statement to the shared Postgres container, and answer what it printed. */
function psql(statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "daykeeper-db",
      "psql",
      "-U",
      "daykeeper",
      "-d",
      "postgres",
      "-tAc",
      statement,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );
}

function readEnvField(envPath, field) {
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && line.slice(0, eq).trim() === field)
      return line.slice(eq + 1).trim();
  }
  return undefined;
}

function main() {
  console.log(`\nDayKeeper worktree teardown — ${worktreeRoot}`);

  if (isMainCheckout()) {
    die(
      "this is the main checkout; there is nothing worktree-scoped to tear down here",
      "run this inside the worktree being retired",
    );
  }

  const envLocalPath = join(worktreeRoot, ".env.local");
  const url = readEnvField(envLocalPath, "DATABASE_URL") ?? "";
  const dbName = url.split("/").pop() ?? "";
  const bucket = readEnvField(envLocalPath, "STORAGE_BUCKET") ?? "";
  const port = Number(readEnvField(envLocalPath, "PORT"));

  // The safety valve. Everything below it may only ever see a wt_ database.
  if (!dbName.startsWith("daykeeper_wt_")) {
    die(
      `refusing: this worktree's DATABASE_URL points at "${dbName || "(nothing)"}", not a daykeeper_wt_* database`,
      "if this worktree was never set up, there is nothing to tear down; otherwise inspect .env.local",
    );
  }

  // 1. Whatever this worktree's dev server left behind on its own port.
  if (Number.isInteger(port) && port > 0) {
    const killed = killByPort(port);
    console.log(
      `  port ${port}: ${killed > 0 ? `${killed} process(es) cleared` : "already free"}`,
    );
  }

  // 2. The database. FORCE closes any connections the dead server still held.
  try {
    psql(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    console.log(`  database ${dbName}: dropped`);
  } catch {
    die(
      `could not drop ${dbName} (is the daykeeper-db container running?)`,
      "docker compose up -d, then rerun; or drop it in Adminer",
    );
  }

  // 2b. KAN-92: the test databases. `npm test` builds its own beside this
  //     worktree's database and drops them when it finishes, but a run that
  //     was killed leaves some behind, and once this worktree is gone no run
  //     will come along to clear them. Their names all start with a hash of
  //     this worktree's database name (testDatabasePrefix), so no other
  //     checkout's are touched. The worktree's own database is already gone,
  //     so a failure here reports rather than dies.
  const testPrefix = testDatabasePrefix(dbName);
  try {
    const leftBehind = psql(
      `SELECT datname FROM pg_database WHERE starts_with(datname, '${testPrefix}') ORDER BY datname`,
    )
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    for (const name of leftBehind) {
      psql(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
    console.log(
      leftBehind.length > 0
        ? `  test databases ${testPrefix}*: ${leftBehind.length} dropped`
        : `  test databases ${testPrefix}*: none left behind`,
    );
  } catch {
    console.log(
      `  test databases ${testPrefix}*: could not look for them or drop them.` +
        `\n    if any are still there later: http://localhost:8080 (Adminer)`,
    );
  }

  // 3. The bucket. Uses the storage container's own client, so this script
  //    keeps its zero-dependency property and works before `npm ci`. A missing
  //    bucket is the normal case for a worktree that never ran db:reset, and
  //    losing storage is not a reason to leave the database behind, so this
  //    reports rather than dies.
  if (!bucket.startsWith("daykeeper-wt-")) {
    console.log(
      `  bucket: skipped (STORAGE_BUCKET is "${bucket || "(unset)"}", not a daykeeper-wt-* bucket)`,
    );
  } else {
    try {
      execFileSync(
        "docker",
        [
          "exec",
          "daykeeper-storage",
          "mc",
          "alias",
          "set",
          "dk",
          "http://localhost:9000",
          "daykeeper",
          "daykeeper_local_dev",
        ],
        { stdio: "ignore", timeout: 15_000 },
      );
      execFileSync(
        "docker",
        ["exec", "daykeeper-storage", "mc", "rb", "--force", `dk/${bucket}`],
        { stdio: "ignore", timeout: 15_000 },
      );
      console.log(`  bucket ${bucket}: removed`);
    } catch {
      console.log(
        `  bucket ${bucket}: could not remove it (storage container not running, or it never existed).` +
          `\n    if it is still there later: http://localhost:19021`,
      );
    }
  }

  console.log(`
Done here. To finish, from the main checkout (git refuses to remove the tree
you are standing in):

  git worktree remove "${worktreeRoot}"
  git branch -d <branch>     # only once its work is merged (or -D to abandon)
`);
}

main();
