/**
 * Sign-in must not say whether an address has an account.
 *
 * docs/api.md promises that a wrong address and a wrong password give the same
 * answer in the same time. The sentence is easy to keep — both paths return
 * NO_MATCH — and the time is easy to lose, because losing it looks like a
 * tidy-up. An early `if (!account) return fail(...)` reads better than hashing
 * a password nobody asked about, and it answers in a millisecond where a real
 * account spends tens of them doing scrypt. That difference is the answer:
 * anyone can learn which of a list of addresses is registered by timing the
 * responses.
 *
 * Nothing guarded this until now. The property survived a whole rewrite of the
 * database layer onto Drizzle (KAN-92) by being read carefully, which is not
 * something to rely on twice.
 *
 * These tests assert the mechanism rather than the clock. A wall-clock
 * assertion on a shared CI runner flakes, and a flaky test gets deleted, which
 * would leave this unguarded again. What can regress is whether the work still
 * happens, and that is exact: the handler must hand verifyPassword a genuine
 * hash even when no account was found, and verifyPassword must be made to do
 * the scrypt work rather than reject a malformed value for free.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const findAccountForSignInMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());
const cookieSetMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/accounts", () => ({
  findAccountForSignIn: findAccountForSignInMock,
}));

vi.mock("@/server/auth/session", () => ({
  SESSION_COOKIE_NAME: "dk_session",
  createSession: createSessionMock,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSetMock }),
}));

// The real password module, with one spy over it: these tests are about what
// the handler asks of verifyPassword, and a fake would answer the question
// with itself.
vi.mock("@/server/auth/password", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/auth/password")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import { POST } from "@/app/api/auth/login/route";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const verifySpy = vi.mocked(verifyPassword);

/** The shape hashPassword writes: scrypt$N$r$p$salt$hash, both base64. */
const SCRYPT = /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*$/;

function signIn(email: string, password: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

/** An account whose password is "correct-horse-battery". */
async function account() {
  return {
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "margaret@example.com",
      displayName: "Margaret",
      role: "user",
      timeZone: "Australia/Melbourne",
    },
    passwordHash: await hashPassword("correct-horse-battery"),
  };
}

beforeEach(() => {
  findAccountForSignInMock.mockReset();
  createSessionMock.mockReset();
  cookieSetMock.mockReset();
  verifySpy.mockClear();
});

describe("the two failures are indistinguishable", () => {
  it("answers an unknown address and a wrong password identically", async () => {
    findAccountForSignInMock.mockResolvedValue(null);
    const unknown = await signIn("nobody@example.com", "whatever");
    const unknownBody = await unknown.json();

    findAccountForSignInMock.mockResolvedValue(await account());
    const wrong = await signIn("margaret@example.com", "not her password");
    const wrongBody = await wrong.json();

    expect(unknown.status).toBe(wrong.status);
    expect(unknown.status).toBe(401);
    // Byte for byte: a difference in wording is the same leak as a difference
    // in timing, only easier to notice.
    expect(unknownBody).toEqual(wrongBody);
    expect(JSON.stringify(unknownBody)).toBe(JSON.stringify(wrongBody));
  });

  it("names neither the address nor the password in the message", async () => {
    findAccountForSignInMock.mockResolvedValue(null);
    const body = (await (await signIn("nobody@example.com", "x")).json()) as {
      error: { message: string };
    };

    const message = body.error.message.toLowerCase();
    for (const giveaway of [
      "no such",
      "not found",
      "unknown",
      "incorrect password",
      "no account",
    ]) {
      expect(message).not.toContain(giveaway);
    }
  });
});

describe("an unknown address pays the same cost", () => {
  it("still checks a password when no account was found", async () => {
    findAccountForSignInMock.mockResolvedValue(null);

    await signIn("nobody@example.com", "whatever");

    // The regression this catches is a handler that returns early on a missing
    // row. Every other test would still pass.
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it("hands it a real hash, so the work is actually done", async () => {
    findAccountForSignInMock.mockResolvedValue(null);

    await signIn("nobody@example.com", "whatever");

    const stored = verifySpy.mock.calls[0]![1];
    // A placeholder like "" or "x" would make verifyPassword return false
    // before doing any scrypt, which puts the timing difference straight back
    // while leaving every assertion above green.
    expect(stored).toMatch(SCRYPT);

    // And it is a value verifyPassword takes seriously: false because the
    // password is wrong, not false because the stored value is unreadable.
    const { verifyPassword: real } = await vi.importActual<
      typeof import("@/server/auth/password")
    >("@/server/auth/password");
    await expect(real("whatever", stored)).resolves.toBe(false);
    const parts = stored.split("$");
    await expect(real(parts.slice(4).join("$"), stored)).resolves.toBe(false);
  });

  it("checks a password the same number of times either way", async () => {
    findAccountForSignInMock.mockResolvedValue(null);
    await signIn("nobody@example.com", "whatever");
    const absent = verifySpy.mock.calls.length;

    verifySpy.mockClear();
    findAccountForSignInMock.mockResolvedValue(await account());
    await signIn("margaret@example.com", "not her password");

    expect(verifySpy.mock.calls.length).toBe(absent);
  });

  it("uses the same stand-in every time, rather than hashing anew", async () => {
    findAccountForSignInMock.mockResolvedValue(null);
    await signIn("one@example.com", "a");
    await signIn("two@example.com", "b");

    // Not about secrecy: a fresh hash per attempt costs a second scrypt on the
    // unknown-address path only, which is a timing difference of its own.
    expect(verifySpy.mock.calls[0]![1]).toBe(verifySpy.mock.calls[1]![1]);
  });
});

describe("and sign-in still works", () => {
  it("accepts the right password", async () => {
    // Without this, a handler that refused everyone would pass every test above.
    findAccountForSignInMock.mockResolvedValue(await account());
    createSessionMock.mockResolvedValue({
      token: "t",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });

    const response = await signIn(
      "margaret@example.com",
      "correct-horse-battery",
    );

    expect(response.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalledTimes(1);
    expect(cookieSetMock).toHaveBeenCalledTimes(1);
  });

  it("never puts the password hash in the answer", async () => {
    findAccountForSignInMock.mockResolvedValue(await account());
    createSessionMock.mockResolvedValue({
      token: "t",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });

    const body = await (
      await signIn("margaret@example.com", "correct-horse-battery")
    ).text();

    expect(body).not.toContain("scrypt");
    expect(body).not.toContain("passwordHash");
  });
});
