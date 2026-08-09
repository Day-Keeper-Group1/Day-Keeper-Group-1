// @ts-check
// Cross-platform port inspection and cleanup. Zero dependencies.
//
// Why this exists: a dev server that did not shut down cleanly (an agent's
// session ended, a terminal was closed) keeps holding its port, and the next
// `npm run dev` dies with EADDRINUSE, which reads like a server bug. Each
// worktree owns a fixed port, so the safe rule is same-port takeover: whoever
// starts clears their OWN port first. Different worktrees have different
// ports, so nobody can hurt anyone else.

import { execFileSync } from "node:child_process";

const isWindows = process.platform === "win32";

/** Every local TCP port currently in LISTEN state. @returns {Set<number>} */
export function listeningPorts() {
  const ports = new Set();
  try {
    if (isWindows) {
      const out = execFileSync("netstat", ["-ano", "-p", "TCP"], {
        encoding: "utf8",
        timeout: 10_000,
      });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING/i);
        if (m) ports.add(Number(m[1]));
      }
    } else {
      const out = execFileSync("lsof", ["-iTCP", "-sTCP:LISTEN", "-P", "-n"], {
        encoding: "utf8",
        timeout: 10_000,
      });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/:(\d+)\s+\(LISTEN\)/);
        if (m) ports.add(Number(m[1]));
      }
    }
  } catch {
    // No netstat/lsof output is not fatal; callers treat it as "unknown".
  }
  return ports;
}

/**
 * Kill whatever is listening on a port. Only ever called on the current
 * worktree's own port. Returns how many processes were told to die.
 * @param {number} port
 */
export function killByPort(port) {
  const pids = new Set();
  try {
    if (isWindows) {
      const out = execFileSync("netstat", ["-ano", "-p", "TCP"], {
        encoding: "utf8",
        timeout: 10_000,
      });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(
          new RegExp(
            `^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`,
            "i",
          ),
        );
        if (m) pids.add(Number(m[1]));
      }
      for (const pid of pids) {
        try {
          execFileSync("taskkill", ["/F", "/PID", String(pid)], {
            stdio: "ignore",
            timeout: 10_000,
          });
        } catch {
          // Already gone, or not ours to kill; either way the port check at
          // bind time is the real arbiter.
        }
      }
    } else {
      const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
        encoding: "utf8",
        timeout: 10_000,
      });
      for (const line of out.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Already gone.
        }
      }
    }
  } catch {
    // Nothing was listening; nothing to do.
  }
  return pids.size;
}
