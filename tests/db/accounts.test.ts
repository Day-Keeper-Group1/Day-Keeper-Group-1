// KAN-92: registering, signing in and signing out, through the route handlers, against a real PostgreSQL.

/**
 * Accounts.
 *
 * The four auth routes are called as a browser would call them, and what they
 * left in the users, sessions and audit_logs tables is read through the
 * witness. The statements behind them are in src/server/db/queries/users.ts
 * and audit.ts; the rule that a person and the audit line about them are
 * written together or not at all is in src/server/auth/accounts.ts.
 *
 * Three things are stand-ins. The browser's cookies (./support/fakes.ts).
 * `insertAuditLog`, which is the real function until one test makes it fail
 * once, to see the registration around it undone. And `verifyPassword`, which
 * is the real function with a record kept of what it was called with, because
 * that is the only way to see that an unknown address is made to cost the
 * same work as a known one.
 */

import { createHash } from "node:crypto";
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () =>
  (await import("./support/fakes")).cookieJar(),
);
vi.mock("@/server/db/queries/audit", async (importActual) => {
  const actual =
    await importActual<typeof import("@/server/db/queries/audit")>();
  return { ...actual, insertAuditLog: vi.fn(actual.insertAuditLog) };
});
vi.mock("@/server/auth/password", async (importActual) => {
  const actual = await importActual<typeof import("@/server/auth/password")>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { verifyPassword } from "@/server/auth/password";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { insertAuditLog } from "@/server/db/queries/audit";

import {
  browserOf,
  cookieValue,
  resetFakes,
  takeCookieChanges,
} from "./support/fakes";
import { rows } from "./support/witness";
import { PASSWORD, aPerson } from "./support/world";

/* How a request is made ----------------------------------------------------- */

const ORIGIN = "http://daykeeper.test";

function get(path: string): Request {
  return new Request(`${ORIGIN}${path}`);
}

function post(path: string, body?: unknown): Request {
  const headers: Record<string, string> = { "user-agent": "accounts test" };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/** Margaret signing up, with the address typed the way people type one. */
const signUp = () =>
  register(
    post("/api/auth/register", {
      email: " Margaret.W@Example.COM ",
      password: PASSWORD,
      displayName: "Margaret Whitfield",
    }),
  );

const signIn = (email: string, password: string) =>
  login(post("/api/auth/login", { email, password }));

/* What is looked at afterwards ---------------------------------------------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** What src/server/auth/password.ts stores: scrypt$N$r$p$salt$hash. */
const A_PASSWORD_HASH = /^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/;

const NO_MATCH = JSON.stringify({
  error: {
    code: "unauthenticated",
    message: "That email and password do not match.",
  },
});

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

async function count(table: "users" | "sessions" | "audit_logs") {
  const [{ n }] = await rows<{ n: number }>(
    `SELECT count(*)::integer AS n FROM ${table}`,
  );
  return n;
}

describe("accounts", () => {
  /** Every call of console.error, with everything it was given. */
  let logged: unknown[][];

  /** Everything that was logged, printed in full: an error with its message, its own fields and its cause. */
  const logText = () => inspect(logged, { depth: null });

  beforeEach(() => {
    resetFakes();
    vi.mocked(insertAuditLog).mockReset();
    vi.mocked(verifyPassword).mockReset();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((...given: unknown[]) => {
      logged.push(given);
    });
    browserOf("Margaret's laptop");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registering", () => {
    it("makes one person, one audit line and one session, and signs her in", async () => {
      const answer = await signUp();

      expect(answer.status).toBe(201);
      const user = await answer.json();
      expect(user).toEqual({
        id: expect.stringMatching(UUID),
        email: "Margaret.W@Example.COM",
        displayName: "Margaret Whitfield",
        role: "user",
        timeZone: "Australia/Melbourne",
      });
      expect(Object.keys(user)).toEqual([
        "id",
        "email",
        "displayName",
        "role",
        "timeZone",
      ]);

      // The address as she typed it, less the spaces, and beside it the form
      // it is matched by.
      const people = await rows<{ password_hash: string }>(
        "SELECT id, email, email_canonical, display_name, password_hash FROM users",
      );
      expect(people).toEqual([
        {
          id: user.id,
          email: "Margaret.W@Example.COM",
          email_canonical: "margaret.w@example.com",
          display_name: "Margaret Whitfield",
          password_hash: expect.stringMatching(A_PASSWORD_HASH),
        },
      ]);
      expect(await verifyPassword(PASSWORD, people[0].password_hash)).toBe(
        true,
      );

      // No detail was given, so the column holds its default: an empty object.
      expect(
        await rows(
          `SELECT actor_id, action, target_type, target_id, detail,
                  jsonb_typeof(detail) AS kind
             FROM audit_logs`,
        ),
      ).toEqual([
        {
          actor_id: user.id,
          action: "user.register",
          target_type: "user",
          target_id: user.id,
          detail: {},
          kind: "object",
        },
      ]);

      // The cookie she was handed opens the one session there is.
      expect(
        await rows("SELECT user_id, token_hash, user_agent FROM sessions"),
      ).toEqual([
        {
          user_id: user.id,
          token_hash: sha256(cookieValue(SESSION_COOKIE_NAME)!),
          user_agent: "accounts test",
        },
      ]);
      expect(logged).toEqual([]);
    });

    it("refuses an address that is already registered, however it is typed", async () => {
      await signUp();
      takeCookieChanges();

      browserOf("somebody else's laptop");
      const answer = await register(
        post("/api/auth/register", {
          email: "margaret.w@example.com",
          password: "another long phrase",
          displayName: "Somebody Else",
        }),
      );

      expect(answer.status).toBe(409);
      expect(await answer.json()).toEqual({
        error: {
          code: "conflict",
          message: "There is already an account with that email address.",
        },
      });
      expect(await count("users")).toBe(1);
      expect(await count("audit_logs")).toBe(1);
      expect(await count("sessions")).toBe(1);
      expect(takeCookieChanges()).toEqual([]);
      // An answer, not an accident: nothing is logged for it.
      expect(logged).toEqual([]);
    });

    it("leaves nobody behind when the audit line cannot be written", async () => {
      vi.mocked(insertAuditLog).mockRejectedValueOnce(
        new Error("the audit log could not be written"),
      );

      const answer = await signUp();

      expect(answer.status).toBe(500);
      expect(await answer.json()).toEqual({
        error: {
          code: "server_error",
          message:
            "Something went wrong at our end. Please try again in a moment.",
        },
      });

      // The person had been written by then, inside the transaction: the audit
      // line was asked to name her. Nothing of her is left.
      const [, entry] = vi.mocked(insertAuditLog).mock.calls[0];
      expect(entry.actorId).toMatch(UUID);
      expect(await count("users")).toBe(0);
      expect(await count("audit_logs")).toBe(0);
      expect(await count("sessions")).toBe(0);
      expect(takeCookieChanges()).toEqual([]);

      expect(logged.map(([first]) => first)).toEqual(["[api] unhandled error"]);
    });

    it("does not call another refusal a taken address, and keeps the password hash out of the log", async () => {
      // The database refuses every new person, for a reason of this test's own.
      await rows(
        `CREATE FUNCTION refuse_new_people() RETURNS trigger LANGUAGE plpgsql
         AS $$ BEGIN RAISE EXCEPTION 'no new people today'; END $$`,
      );
      await rows(
        `CREATE TRIGGER refuse_new_people BEFORE INSERT ON users
         FOR EACH ROW EXECUTE FUNCTION refuse_new_people()`,
      );
      try {
        const answer = await signUp();

        expect(answer.status).toBe(500);
        expect(await count("users")).toBe(0);
        expect(await count("audit_logs")).toBe(0);
        expect(await count("sessions")).toBe(0);
      } finally {
        // The tables are emptied before every test; a trigger would stay.
        await rows("DROP TRIGGER refuse_new_people ON users");
        await rows("DROP FUNCTION refuse_new_people()");
      }

      // The error Drizzle throws for this statement quotes every value bound
      // to it, and one of them is the hash of her password. What is logged is
      // the error PostgreSQL sent, which quotes none.
      expect(logged).toHaveLength(1);
      const [label, error] = logged[0];
      expect(label).toBe("[api] unhandled error");
      expect((error as Error).message).toBe("no new people today");
      expect(logText()).not.toContain("scrypt$");
    });
  });

  describe("signing in", () => {
    it("finds her across case and spaces, and answers what registering answered", async () => {
      const registered = await (await signUp()).text();

      browserOf("Margaret's phone");
      const answer = await signIn("  MARGARET.W@example.com ", PASSWORD);

      expect(answer.status).toBe(200);
      expect(await answer.text()).toBe(registered);
      expect(await count("sessions")).toBe(2);
      expect(await (await me(get("/api/auth/me"))).text()).toBe(
        `{"user":${registered}}`,
      );
      expect(logged).toEqual([]);
    });

    it("has one sentence, and the same work, for a wrong password, an unknown address and a deactivated account", async () => {
      const margaret = await aPerson("Margaret");
      const dorothy = await aPerson("Dorothy");
      await rows("UPDATE users SET deactivated_at = now() WHERE id = $1", [
        dorothy.id,
      ]);
      const stored = await rows<{ email: string; password_hash: string }>(
        "SELECT email, password_hash FROM users",
      );
      const hashOf = (email: string) =>
        stored.find((person) => person.email === email)!.password_hash;

      const answers = [
        await signIn(margaret.email, "not her password"),
        await signIn("nobody@example.com", PASSWORD),
        await signIn(dorothy.email, PASSWORD),
      ];

      for (const answer of answers) {
        expect(answer.status).toBe(401);
        expect(await answer.text()).toBe(NO_MATCH);
      }
      expect(await count("sessions")).toBe(0);
      expect(takeCookieChanges()).toEqual([]);

      // Each attempt paid for one comparison against a real hash: hers the
      // first time, and after that the stand-in kept for an address with no
      // active account, which is the same one both times and nobody's own.
      const comparedWith = vi
        .mocked(verifyPassword)
        .mock.calls.map(([, hash]) => hash);
      expect(comparedWith).toHaveLength(3);
      expect(comparedWith[0]).toBe(hashOf(margaret.email));
      expect(comparedWith[1]).toMatch(A_PASSWORD_HASH);
      expect(comparedWith[2]).toBe(comparedWith[1]);
      expect(comparedWith[1]).not.toBe(hashOf(dorothy.email));
      expect(logged).toEqual([]);
    });
  });

  it("never puts the password hash in an answer", async () => {
    const answers = [
      await (await signUp()).text(),
      await (await signIn("margaret.w@example.com", PASSWORD)).text(),
      await (await me(get("/api/auth/me"))).text(),
    ];
    const [{ password_hash: hash }] = await rows<{ password_hash: string }>(
      "SELECT password_hash FROM users",
    );

    for (const answer of answers) {
      expect(answer).not.toContain(hash);
      expect(answer).not.toMatch(/scrypt|password/i);
    }
  });

  it("says who is signed in, signs her out, and then says nobody", async () => {
    const registered = await (await signUp()).text();

    expect(await (await me(get("/api/auth/me"))).text()).toBe(
      `{"user":${registered}}`,
    );

    const signedOut = await logout(post("/api/auth/logout"));
    expect(signedOut.status).toBe(200);
    expect(await signedOut.json()).toEqual({ signedOut: true });
    expect(await count("sessions")).toBe(0);
    expect(cookieValue(SESSION_COOKIE_NAME)).toBeUndefined();

    expect(await (await me(get("/api/auth/me"))).json()).toEqual({
      user: null,
    });
    const again = await logout(post("/api/auth/logout"));
    expect(again.status).toBe(401);
    expect(await again.json()).toEqual({
      error: { code: "unauthenticated", message: "Please sign in." },
    });
    expect(logged).toEqual([]);
  });
});
