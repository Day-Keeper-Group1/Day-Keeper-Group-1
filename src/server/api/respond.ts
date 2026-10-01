import type { ApiError } from "@/lib/contract/api";
import { UnauthenticatedError } from "@/server/auth/session";
import { dbCause } from "@/server/db/errors";

/**
 * The one place an HTTP response is built.
 *
 * Every endpoint in docs/api.md answers with the same error envelope, so it is
 * assembled here once and imported rather than restated thirteen times. The
 * status is derived from the code instead of being passed beside it, because
 * the two getting out of step is the failure this file exists to prevent.
 */

type ErrorCode = ApiError["error"]["code"];

/** The table from docs/api.md, "How to talk to it". */
const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_many_requests: 429,
  server_error: 500,
};

/** A successful answer. */
export function json<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

/**
 * A failed answer.
 *
 * `message` is shown to a person as-is, so it is written as a sentence and
 * never carries a stack trace, a SQL fragment, or the contents of a letter.
 */
export function fail(
  code: ErrorCode,
  message: string,
  fields?: Record<string, string>,
): Response {
  const body: ApiError = {
    error: { code, message, ...(fields && { fields }) },
  };
  return Response.json(body, { status: STATUS[code] });
}

type Handler<A extends unknown[]> = (
  request: Request,
  ...rest: A
) => Promise<Response>;

/**
 * Wrap a handler so the two failures every endpoint shares are handled in one
 * place: no session, and something we did not foresee.
 *
 * The second case answers a generic sentence on purpose. A database error
 * naming a column, or a driver error naming a host, is our problem to read in
 * the log and nobody else's to receive over the wire.
 */
export function route<A extends unknown[]>(handler: Handler<A>): Handler<A> {
  return async (request, ...rest) => {
    try {
      return await handler(request, ...rest);
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        return fail("unauthenticated", error.message);
      }
      // KAN-92: a statement that failed through Drizzle arrives wrapped, and the
      // wrapper's message quotes every value bound to the statement: a
      // password hash, the contents of a letter. dbCause() leaves the wrapper
      // out, so what is logged is the driver's own error, as it was before
      // Drizzle. For a constraint violation that one can still quote the
      // failing row in its `detail`, exactly as it could before this change.
      console.error("[api] unhandled error", dbCause(error));
      return fail(
        "server_error",
        "Something went wrong at our end. Please try again in a moment.",
      );
    }
  };
}
