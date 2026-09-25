// @ts-check
// worktree-setup: take a fresh git worktree from zero to isolated.
//
// One shared docker stack serves every checkout; each worktree owns its own
// DATABASE inside the one Postgres, and its own dev PORT. Both are derived
// deterministically from the branch name (scripts/lib/worktree-naming.mjs)
// and written into this worktree's .env.local, so nothing is hand-copied and
// nothing can silently share state with another worktree.
//
// Zero dependencies: runs before `npm ci`. Idempotent: run it as often as
// you like. Every failure names the real cause in human words, because an
// environment problem must never wear a code-bug mask.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveWorktreeNames, MAIN_PORT } from "./lib/worktree-naming.mjs";
import { listeningPorts } from "./lib/port-utils.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const worktreeRoot = resolve(here, "..");

/** Fail loudly, name the real cause, hand over the fix, exit non-zero. */
function die(humanReason, fixCommand) {
  console.error(`\nworktree-setup stopped: ${humanReason}`);
  if (fixCommand) console.error(`  fix: ${fixCommand}`);
  console.error(
    "  (This is the environment not being ready, not a bug in the code.)\n",
  );
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: worktreeRoot,
    encoding: "utf8",
  }).trim();
}

/** True when this checkout is the main one rather than a linked worktree. */
function isMainCheckout() {
  try {
    const gitDir = git(["rev-parse", "--absolute-git-dir"]);
    const commonDir = git(["rev-parse", "--git-common-dir"]);
    return resolve(gitDir) === resolve(worktreeRoot, commonDir);
  } catch {
    return false;
  }
}

/** Minimal KEY=VALUE reader for one field of an env file. */
function readEnvField(envPath, field) {
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && line.slice(0, eq).trim() === field)
      return line.slice(eq + 1).trim();
  }
  return undefined;
}

/** Ports already claimed by any worktree's .env.local, so probing skips them. */
function claimedPorts() {
  const claimed = new Set();
  try {
    const out = git(["worktree", "list", "--porcelain"]);
    for (const m of out.matchAll(/^worktree\s+(.+)$/gm)) {
      const path = resolve(m[1].trim());
      if (path === worktreeRoot) continue;
      const v = Number(readEnvField(join(path, ".env.local"), "PORT"));
      if (Number.isInteger(v) && v > 0) claimed.add(v);
    }
  } catch {
    // Without the list we still probe against listening ports below.
  }
  return claimed;
}

function pickPort(preferred) {
  const claimed = claimedPorts();
  const listening = listeningPorts();
  const taken = (p) => p === MAIN_PORT || claimed.has(p) || listening.has(p);
  for (let i = 0; i < 99; i++) {
    const p = 3001 + ((preferred - 3001 + i) % 99);
    if (!taken(p)) return p;
  }
  die(
    "no free port in 3001-3099 (are 99 worktrees running?)",
    "free one up, or set PORT in .env.local by hand",
  );
}

/** Run psql inside the shared container. Returns stdout. */
function psql(dbName, sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "daykeeper-db",
      "psql",
      "-U",
      "daykeeper",
      "-d",
      dbName,
      "-tAc",
      sql,
    ],
    { encoding: "utf8", timeout: 15_000 },
  ).trim();
}

function main() {
  console.log(`\nDayKeeper worktree setup — ${worktreeRoot}`);

  if (isMainCheckout()) {
    die(
      "this is the main checkout, which keeps the shared defaults (database `daykeeper`, port 3000)",
      "run this only inside a worktree: git worktree add ../daykeeper-worktrees/<slug> -b <branch>",
    );
  }

  // 1. Docker first, so nothing later fails with a connection error in disguise.
  try {
    execFileSync(
      "docker",
      ["exec", "daykeeper-db", "pg_isready", "-U", "daykeeper"],
      {
        stdio: "ignore",
        timeout: 15_000,
      },
    );
  } catch {
    die(
      "the shared Postgres container (daykeeper-db) is not reachable",
      "docker compose up -d   (from any checkout; every worktree shares the one stack)",
    );
  }

  // 2. Derive this worktree's identity from its branch.
  let branch = "";
  try {
    branch = git(["branch", "--show-current"]);
  } catch {
    /* handled below */
  }
  if (!branch) {
    die(
      "cannot read the current branch",
      "create the worktree with a branch: git worktree add ../daykeeper-worktrees/<slug> -b <branch>",
    );
  }
  const names = deriveWorktreeNames(branch);

  // 3. A free port, preferring the branch-derived one.
  const existingPort = Number(
    readEnvField(join(worktreeRoot, ".env.local"), "PORT"),
  );
  const port =
    Number.isInteger(existingPort) && existingPort > MAIN_PORT
      ? existingPort // already assigned earlier; keep it stable
      : pickPort(names.preferredPort);

  // 4. Write .env.local: generated from .env.example (all public dev defaults;
  //    this project bans personal keys, so there is nothing to inherit), with
  //    the database name and port swapped in. Idempotent: rewrites only the
  //    two managed fields, keeps everything else a person may have added.
  const envLocalPath = join(worktreeRoot, ".env.local");
  let content = existsSync(envLocalPath)
    ? readFileSync(envLocalPath, "utf8")
    : readFileSync(join(worktreeRoot, ".env.example"), "utf8");
  const setField = (field, value) => {
    const re = new RegExp(`^(\\s*${field}\\s*=).*$`, "m");
    if (re.test(content)) content = content.replace(re, `$1${value}`);
    else content = `${content.trimEnd()}\n${field}=${value}\n`;
  };
  setField(
    "DATABASE_URL",
    `postgres://daykeeper:daykeeper_local_dev@localhost:15432/${names.dbName}`,
  );
  // KAN-66: the storage port is written too, so rerunning setup in a worktree
  // made before the ports moved below 49152 brings its .env.local up to date.
  setField("STORAGE_ENDPOINT", "http://localhost:19020");
  setField("PORT", String(port));
  // Its own bucket as well as its own database: `db:reset` empties storage, and
  // a shared bucket would make one worktree's reset delete another's uploads.
  // Nothing needs to create it here; `npm run db:reset` does that.
  setField("STORAGE_BUCKET", names.bucketName);
  writeFileSync(envLocalPath, content);
  console.log(`  database  ${names.dbName}`);
  console.log(`  bucket    ${names.bucketName}`);
  console.log(`  port      ${port}`);

  // 5. Create the database if it does not exist yet.
  const exists = psql(
    "postgres",
    `SELECT 1 FROM pg_database WHERE datname='${names.dbName}'`,
  );
  if (exists === "1") {
    console.log("  (database already exists; kept)");
  } else {
    psql("postgres", `CREATE DATABASE "${names.dbName}"`);
    console.log("  (database created)");
  }

  console.log(`
Ready. This worktree is fully isolated: its own database, its own bucket, its
own port.

  npm ci             # once per worktree
  npm run db:reset   # schema + seed + bucket, all THIS worktree's own
  npm run dev        # http://localhost:${port}

When the work here is merged or abandoned: npm run worktree:teardown
`);
}

main();
