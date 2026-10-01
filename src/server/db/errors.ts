// KAN-92: what a failed statement throws, and how to reach the error PostgreSQL sent.

/**
 * Database errors.
 *
 * A statement that fails through Drizzle throws DrizzleQueryError. The error
 * PostgreSQL sent is its `cause`, so the SQLSTATE is at `error.cause.code` and
 * `error.code` is undefined. And the wrapper's own message quotes the
 * statement together with every value bound to it, which for this product is a
 * password hash or the contents of a letter. So nothing reads or logs the
 * wrapper: it is unwrapped here first.
 *
 * What is left is the driver's own error, the one this code read and logged
 * before Drizzle. Unwrapping takes away the wrapper's list of bound values
 * and nothing more. The driver's error is not free of data: for a constraint
 * violation its `detail` can quote the row that failed, exactly as it could
 * before this change.
 *
 * Script-safe: no `server-only`, because the scripts in db/ and Vitest load
 * this file outside Next.js, where that module throws.
 */

import { DrizzleQueryError } from "drizzle-orm";

/** The driver's own error, out of Drizzle's wrapper: it carries the SQLSTATE, and the wrapper's list of bound values stays behind. */
export function dbCause(error: unknown): unknown {
  return error instanceof DrizzleQueryError && error.cause
    ? error.cause
    : error;
}

/** PostgreSQL unique violation (23505). */
export function isUniqueViolation(error: unknown): boolean {
  const cause = dbCause(error);
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: unknown }).code === "23505"
  );
}
