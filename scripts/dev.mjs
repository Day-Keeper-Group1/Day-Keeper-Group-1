// @ts-check
// dev launcher: start Next on this checkout's own port, taking the port over
// from any stale predecessor first.
//
// Why not plain `next dev`: the port must come from .env.local (each worktree
// owns one; the main checkout keeps 3000), and Next decides its port before
// it loads env files, so something outside Next has to read it. And a dev
// server whose session died keeps holding the port, so the next start would
// hit EADDRINUSE, which reads like a server bug. Same-port takeover fixes
// both: read own port, clear own port, start. Other worktrees run on other
// ports and are never touched.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { killByPort } from "./lib/port-utils.mjs";
import { MAIN_PORT } from "./lib/worktree-naming.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function readEnvField(envPath, field) {
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && line.slice(0, eq).trim() === field)
      return line.slice(eq + 1).trim();
  }
  return undefined;
}

const fromEnv = Number(readEnvField(join(root, ".env.local"), "PORT"));
const port = Number.isInteger(fromEnv) && fromEnv > 0 ? fromEnv : MAIN_PORT;

const cleared = killByPort(port);
if (cleared > 0) {
  console.log(
    `[dev] cleared ${cleared} stale process(es) holding port ${port}`,
  );
}

const child = spawn("npx", ["next", "dev", "-p", String(port)], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
