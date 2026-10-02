// KAN-92: a session opened, resolved and ended, against a real PostgreSQL.

/**
 * Who is asking.
 *
 * src/server/auth/session.ts answers that question for every protected
 * request, with one statement that checks three things and stamps a fourth.
 * Here its functions run against a real database, and what they left in the
 * sessions table is read through the witness.
 *
 * Only the browser's cookies are a stand-in (./support/fakes.ts). An expired
 * session and a deactivated account are things no code writes, so these tests
 * make them directly: a row moved into the past, a column set.
 */

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () =>
  (await import("./support/fakes")).cookieJar(),
);

import {
  SESSION_COOKIE_NAME,
  UnauthenticatedError,
  createSession,
  destroySession,
  getCurrentUser,
  requireUser,
} from "@/server/auth/session";

import {
  browserOf,
  keepCookie,
  resetFakes,
  withTheAppClockIn2001,
} from "./support/fakes";
import { backdate, rows } from "./support/witness";
import { aPerson, type Person } from "./support/world";

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** Open a session for a person and put its cookie in a browser of that name. */
async function signIn(person: Person, browser: string): Promise<string> {
  const { token } = await createSession(person.id);
  browserOf(browser);
  keepCookie(SESSION_COOKIE_NAME, token);
  return token;
}

/** The id of the row a token opened. */
async function sessionOf(token: string): Promise<string> {
  const [session] = await rows<{ id: string }>(
    "SELECT id FROM sessions WHERE token_hash = $1",
    [sha256(token)],
  );
  return session.id;
}

/**
 * What a session row says about time: whether it was seen within the last
 * minute by the database's clock, and when it expires, as text.
 */
async function clockOf(token: string) {
  const [session] = await rows<{ seenJustNow: boolean; expiresAt: string }>(
    `SELECT last_seen_at > now() - interval '1 minute' AS "seenJustNow",
            expires_at::text AS "expiresAt"
       FROM sessions WHERE token_hash = $1`,
    [sha256(token)],
  );
  return session;
}

/** What the browser receives for a person every new account looks like. */
const asReceived = (person: Person) => ({
  id: person.id,
  email: person.email,
  displayName: person.displayName,
  role: "user",
  timeZone: person.timeZone,
});

describe("sessions", () => {
  let margaret: Person;
  let dorothy: Person;

  beforeEach(async () => {
    resetFakes();
    margaret = await aPerson("Margaret");
    dorothy = await aPerson("Dorothy");
  });

  describe("opening one", () => {
    it("stores the SHA-256 of the token, never the token", async () => {
      const { token, expiresAt } = await createSession(
        margaret.id,
        "Firefox on a laptop",
      );

      expect(
        await rows(
          "SELECT user_id, token_hash, user_agent, expires_at FROM sessions",
        ),
      ).toEqual([
        {
          user_id: margaret.id,
          token_hash: sha256(token),
          user_agent: "Firefox on a laptop",
          expires_at: expiresAt,
        },
      ]);
    });

    it("expires thirty days out", async () => {
      const before = Date.now();
      const { expiresAt } = await createSession(margaret.id);
      const after = Date.now();

      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + thirtyDays);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + thirtyDays);
    });

    it("keeps no user agent when the browser sent none", async () => {
      await createSession(margaret.id);

      expect(await rows("SELECT user_agent FROM sessions")).toEqual([
        { user_agent: null },
      ]);
    });
  });

  describe("resolving one", () => {
    it("answers the person the cookie belongs to, as the browser receives them", async () => {
      await signIn(margaret, "Margaret's laptop");
      await signIn(dorothy, "Dorothy's phone");

      // As text, because the order of the keys is part of what a route sends.
      browserOf("Margaret's laptop");
      expect(JSON.stringify(await getCurrentUser())).toBe(
        JSON.stringify(asReceived(margaret)),
      );
      expect(await requireUser()).toEqual(asReceived(margaret));

      browserOf("Dorothy's phone");
      expect(await getCurrentUser()).toEqual(asReceived(dorothy));
    });

    it("stamps last_seen_at on that session alone, and does not extend it", async () => {
      const laptop = await signIn(margaret, "Margaret's laptop");
      const phone = await signIn(margaret, "Margaret's phone");
      const hers = await signIn(dorothy, "Dorothy's phone");
      for (const token of [laptop, phone, hers]) {
        await backdate(
          "sessions",
          "last_seen_at",
          await sessionOf(token),
          "2 hours",
        );
      }
      const expiry = (await clockOf(laptop)).expiresAt;

      browserOf("Margaret's laptop");
      expect(await getCurrentUser()).toEqual(asReceived(margaret));

      expect(await clockOf(laptop)).toEqual({
        seenJustNow: true,
        expiresAt: expiry,
      });
      expect((await clockOf(phone)).seenJustNow).toBe(false);
      expect((await clockOf(hers)).seenJustNow).toBe(false);
    });

    it("answers nobody when the browser holds no cookie", async () => {
      await signIn(margaret, "Margaret's laptop");

      browserOf("a browser nobody signed in from");
      expect(await getCurrentUser()).toBeNull();
      await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it("answers nobody for a token that opens nothing", async () => {
      await signIn(margaret, "Margaret's laptop");

      browserOf("somebody guessing");
      keepCookie(SESSION_COOKIE_NAME, "a token nobody was ever given");
      expect(await getCurrentUser()).toBeNull();
    });

    it("answers nobody once the session has expired, and does not stamp it", async () => {
      const token = await signIn(margaret, "Margaret's laptop");
      const session = await sessionOf(token);
      await backdate("sessions", "expires_at", session, "31 days");
      await backdate("sessions", "last_seen_at", session, "2 hours");

      expect(await getCurrentUser()).toBeNull();
      await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
      expect((await clockOf(token)).seenJustNow).toBe(false);
    });

    // A session is stamped, and held to its expiry, by the database's clock.
    // On one machine the app's clock agrees with it, so the tests above
    // cannot tell the two apart. By a clock that says 2001, a session that
    // expired yesterday still has twenty-five years to run.
    it("holds a session to the database's clock, whatever the app's clock says", async () => {
      const token = await signIn(margaret, "Margaret's laptop");
      const session = await sessionOf(token);
      await backdate("sessions", "last_seen_at", session, "2 hours");

      expect(await withTheAppClockIn2001(() => getCurrentUser())).toEqual(
        asReceived(margaret),
      );
      expect((await clockOf(token)).seenJustNow).toBe(true);

      await backdate("sessions", "expires_at", session, "31 days");
      await backdate("sessions", "last_seen_at", session, "2 hours");

      expect(await withTheAppClockIn2001(() => getCurrentUser())).toBeNull();
      expect((await clockOf(token)).seenJustNow).toBe(false);
    });

    it("answers nobody once the account is deactivated, and does not stamp it", async () => {
      const token = await signIn(margaret, "Margaret's laptop");
      await signIn(dorothy, "Dorothy's phone");
      await backdate(
        "sessions",
        "last_seen_at",
        await sessionOf(token),
        "2 hours",
      );
      await rows("UPDATE users SET deactivated_at = now() WHERE id = $1", [
        margaret.id,
      ]);

      browserOf("Margaret's laptop");
      expect(await getCurrentUser()).toBeNull();
      expect((await clockOf(token)).seenJustNow).toBe(false);

      // Only her. Everybody else is still who they were.
      browserOf("Dorothy's phone");
      expect(await getCurrentUser()).toEqual(asReceived(dorothy));
    });
  });

  describe("ending one", () => {
    // Pinned as it behaves. The comments in session.ts and in the logout route
    // say signing out ends the session everywhere; what goes is the one row
    // of the browser that asked.
    it("deletes the row of the browser that asked, and no other", async () => {
      await signIn(margaret, "Margaret's laptop");
      const phone = await signIn(margaret, "Margaret's phone");
      const hers = await signIn(dorothy, "Dorothy's phone");

      browserOf("Margaret's laptop");
      await destroySession();

      const left = await rows<{ token_hash: string }>(
        "SELECT token_hash FROM sessions",
      );
      expect(left.map((session) => session.token_hash).sort()).toEqual(
        [sha256(phone), sha256(hers)].sort(),
      );

      // The browser still holds its cookie, and the cookie opens nothing.
      expect(await getCurrentUser()).toBeNull();
      browserOf("Margaret's phone");
      expect(await getCurrentUser()).toEqual(asReceived(margaret));
    });

    it("does nothing for a browser that holds no cookie", async () => {
      await signIn(margaret, "Margaret's laptop");

      browserOf("a browser nobody signed in from");
      await destroySession();

      expect(await rows("SELECT id FROM sessions")).toHaveLength(1);
    });
  });
});
