// @ts-check
// Derive a worktree's database name, storage bucket and dev port from its
// branch name.
//
// Deterministic on purpose: the same branch always maps to the same database
// and the same port, so nothing needs a registry and two runs cannot disagree.
// The six-character hash of the FULL branch name is appended because
// sanitising collides ("feat/foo" and "feat-foo" both become "feat_foo");
// the hash keeps the mapping injective.
//
// Zero dependencies (node builtins only): worktree-setup runs before `npm ci`.
// setup, teardown and dev all import this one file so the names cannot drift.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** The main checkout's port; worktrees are assigned 3001-3099. */
export const MAIN_PORT = 3000;

/** @param {string} branch raw output of `git branch --show-current` */
export function deriveWorktreeNames(branch) {
  const trimmed = (branch ?? "").trim();
  if (!trimmed) {
    throw new Error(
      "deriveWorktreeNames: empty branch name (not on a branch? `git worktree add ... -b <branch>` first)",
    );
  }

  const hash = createHash("sha1").update(trimmed).digest("hex").slice(0, 6);

  // Lowercase, collapse anything outside [a-z0-9] to single underscores.
  const rawSlug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Postgres identifiers cap at 63 bytes: "daykeeper_wt_" (13) + "_" + hash (6).
  const maxSlug = 63 - "daykeeper_wt_".length - 1 - hash.length;
  const slug = rawSlug.slice(0, maxSlug).replace(/_+$/g, "") || "wt";

  // Spread worktrees across 3001-3099 by hash, so two setups running at the
  // same moment almost never want the same port; setup still probes for a
  // genuinely free one from here.
  const preferredPort = 3001 + (parseInt(hash.slice(0, 4), 16) % 99);

  // A bucket per worktree, for the reason there is a database per worktree:
  // `db:reset` empties storage too, and one shared bucket would mean one agent
  // deleting another's uploads. Bucket names cannot hold underscores, so the
  // same slug is spelled with hyphens; the 63-character limit is the same as
  // Postgres's, so the cap above already covers it.
  const bucketName = `daykeeper-wt-${slug.replace(/_/g, "-")}-${hash}`;

  return {
    branch: trimmed,
    slug,
    hash,
    dbName: `daykeeper_wt_${slug}_${hash}`,
    bucketName,
    preferredPort,
  };
}

// `node scripts/lib/worktree-naming.mjs [branch]` prints the derived names.
// No branch argument: reads the current one, so nobody fights shell
// substitution syntax. pathToFileURL is required on Windows, where
// import.meta.url is file:///D:/... but argv[1] is D:\...
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let branch = process.argv[2] ?? "";
  if (!branch) {
    try {
      branch = execFileSync("git", ["branch", "--show-current"], {
        encoding: "utf8",
      }).trim();
    } catch {
      // deriveWorktreeNames will throw its human-readable error below.
    }
  }
  console.log(JSON.stringify(deriveWorktreeNames(branch), null, 2));
}
