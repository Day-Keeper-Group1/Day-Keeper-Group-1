/**
 * Whether a URL points at something on this machine.
 *
 * One definition, because the answer decides two things that must not disagree:
 * whether a script is allowed to drop every table, and whether a database
 * connection has to be encrypted. There were five of these, written at
 * different times, and no two matched the same set of hosts —
 * `db/reset.ts` knew about host.docker.internal and `src/server/env.ts` did
 * not, so the same connection string could be local enough to wipe and remote
 * enough to need TLS.
 *
 * The host is parsed out rather than searched for. Every one of the old copies
 * matched somewhere in the string instead, and the loosest of them,
 * `/localhost|127\.0\.0\.1/`, has no anchor at all: a password containing the
 * word, or a hosted database named my-localhost-db.example.com, was enough to
 * be told it was safe to drop. A URL has exactly one host and the parser knows
 * where it is.
 *
 * Unparseable means not local. The question is only ever asked to decide
 * whether something destructive may proceed, so the answer to "I cannot tell"
 * is no.
 *
 * Deliberately free of imports, including `server-only`: db/ and scripts/ run
 * outside Next.js, where that module throws, and they are the callers that
 * most need to get this right.
 */

/**
 * `db` is the service name in docker-compose.yml, which is the host the app
 * uses when it runs in a container beside the database rather than on the
 * laptop. `host.docker.internal` is the other direction: a container reaching
 * back out to a database on the laptop.
 */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
  "db",
  "storage",
]);

export function hostIsLocal(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  // The URL parser keeps an IPv6 literal in its brackets: "[::1]".
  return LOCAL_HOSTS.has(hostname.replace(/^\[|\]$/g, "").toLowerCase());
}
