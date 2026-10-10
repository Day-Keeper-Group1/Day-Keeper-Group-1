/**
 * Two people registering the same address at the same moment.
 *
 * Asking whether an address is taken and then inserting reads more naturally
 * and is wrong: both requests pass the check, both insert, and one of them
 * fails on the unique index anyway — with nobody having written a message for
 * it, so she is shown a server error for something the product has a sentence
 * about. src/server/auth/accounts.ts says this in its own words; these tests
 * are what stops the comment outliving the behaviour.
 *
 * The window is small and real. It is also invisible: every test written the
 * obvious way passes against select-then-insert, because a single request
 * never races itself.
 *
 * KAN-92 moved this path onto Drizzle, which changed what a failed statement
 * throws. The SQLSTATE used to be on the error; it is now on the error's
 * cause, and isUniqueViolation had to learn the difference. That is the kind
 * of detail a later upgrade quietly undoes, so it is asserted here against
 * both shapes.
 */

import { describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";

import { dbCause, isUniqueViolation } from "@/server/db/errors";

/**
 * What `pg` throws on a constraint violation: an Error carrying the SQLSTATE
 * and, for a unique violation, a `detail` that quotes the offending row.
 */
function pgError(code: string, detail?: string): Error & { code: string } {
  const error = new Error(
    `duplicate key value violates unique constraint`,
  ) as Error & {
    code: string;
    detail?: string;
  };
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

/**
 * Drizzle's wrapper around it.
 *
 * Built from the prototype rather than the constructor on purpose: the
 * constructor's parameters are not part of the API we depend on, and a test
 * that breaks when they change would be testing drizzle-orm rather than us.
 * What we depend on is that the wrapper is an instance of this class and keeps
 * the driver's error as `cause`.
 */
function wrapped(cause: unknown, query = "insert into users ..."): Error {
  const error = Object.create(DrizzleQueryError.prototype) as Error & {
    cause?: unknown;
  };
  Object.assign(error, {
    name: "DrizzleQueryError",
    // The wrapper quotes the statement and every value bound to it, which here
    // is a password hash. This is why nothing logs the wrapper.
    message: `Failed query: ${query}\nparams: scrypt$32768$8$1$c2FsdA==$aGFzaA==`,
    cause,
  });
  return error;
}

describe("recognising a unique violation", () => {
  it("sees 23505 on the driver's own error", () => {
    expect(isUniqueViolation(pgError("23505"))).toBe(true);
  });

  it("sees 23505 through Drizzle's wrapper", () => {
    // The shape the register route actually catches since KAN-92. Reading
    // `error.code` here would find undefined and answer 500.
    expect(isUniqueViolation(wrapped(pgError("23505")))).toBe(true);
  });

  it.each([
    ["23503", "a foreign key"],
    ["23502", "a not-null constraint"],
    ["23514", "a check constraint"],
    ["40001", "a serialisation failure"],
  ])("does not mistake %s (%s) for it", (code) => {
    expect(isUniqueViolation(pgError(code))).toBe(false);
    expect(isUniqueViolation(wrapped(pgError(code)))).toBe(false);
  });

  it("is safe on anything else a catch can receive", () => {
    // A `catch` cannot know where its error came from: storage, the reader, or
    // a thrown string. None of them may be read as a taken address.
    for (const value of [
      null,
      undefined,
      "23505",
      23505,
      new Error("boom"),
      {},
    ]) {
      expect(isUniqueViolation(value)).toBe(false);
    }
  });
});

describe("unwrapping, and what it leaves behind", () => {
  it("hands back the driver's error from inside the wrapper", () => {
    const driver = pgError("23505");
    expect(dbCause(wrapped(driver))).toBe(driver);
  });

  it("hands anything else back untouched", () => {
    const other = new Error("from storage");
    expect(dbCause(other)).toBe(other);
    expect(dbCause("a string")).toBe("a string");
    expect(dbCause(null)).toBe(null);
  });

  it("drops the bound values the wrapper quoted", () => {
    // The reason nothing reads or logs the wrapper: its message carries the
    // parameters, and for this table a parameter is a password hash.
    const outer = wrapped(pgError("23505"));
    expect(outer.message).toContain("scrypt$");

    const inner = dbCause(outer) as Error;
    expect(inner.message).not.toContain("scrypt$");
  });
});

describe("what the person is told", () => {
  it("answers 409 with a sentence, not 500", async () => {
    vi.resetModules();

    const registerAccountMock = vi.fn();
    const EmailTakenClass = class EmailTaken extends Error {};

    vi.doMock("@/server/auth/accounts", () => ({
      registerAccount: registerAccountMock,
      EmailTaken: EmailTakenClass,
    }));
    vi.doMock("@/server/auth/session", () => ({
      SESSION_COOKIE_NAME: "dk_session",
      createSession: vi.fn(),
    }));
    vi.doMock("next/headers", () => ({
      cookies: async () => ({ set: vi.fn() }),
    }));

    registerAccountMock.mockRejectedValue(new EmailTakenClass());

    const { POST } = await import("@/app/api/auth/register/route");
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "margaret@example.com",
          displayName: "Margaret",
          password: "correct-horse-battery",
        }),
      }),
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("conflict");
    // Worded for her, not for a log.
    expect(body.error.message).toMatch(/already an account/i);

    vi.doUnmock("@/server/auth/accounts");
    vi.doUnmock("@/server/auth/session");
    vi.doUnmock("next/headers");
    vi.resetModules();
  });
});
