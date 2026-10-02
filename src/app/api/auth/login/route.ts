import { cookies } from "next/headers";

import { fail, json, route } from "@/server/api/respond";
import { findAccountForSignIn } from "@/server/auth/accounts";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { SESSION_COOKIE_NAME, createSession } from "@/server/auth/session";

/**
 * POST /api/auth/login — exchange an email and password for a session.
 *
 * Spec: docs/api.md, "Sign in".
 */

/**
 * One sentence for both "no such address" and "wrong password".
 *
 * docs/api.md: the two answers are identical and take the same time, so this
 * endpoint cannot be used to find out who has an account.
 */
const NO_MATCH = "That email and password do not match.";

/**
 * A real hash to compare against when no user was found.
 *
 * Returning early on a missing row would answer in a millisecond while a real
 * account spends the scrypt work, and that difference is the answer. So an
 * unknown address pays the same cost. It has to be a genuine hash: verifyPassword
 * rejects a malformed stored value before doing any work, which would leak the
 * timing right back. Computed once per process, on first use.
 */
let noSuchUserHash: Promise<string> | null = null;
function absentUserHash(): Promise<string> {
  noSuchUserHash ??= hashPassword("no such user; take the same time anyway");
  return noSuchUserHash;
}

export const POST = route(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  if (!body || typeof body !== "object") {
    return fail("invalid_request", "Please send an email and a password.");
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const fields: Record<string, string> = {};
  if (!email) fields.email = "Please enter your email address.";
  if (!password) fields.password = "Please enter your password.";
  if (Object.keys(fields).length > 0) {
    return fail("invalid_request", "Please fill in both boxes.", fields);
  }

  // email_canonical is lower(btrim(email)), generated and uniquely indexed in
  // src/server/db/schema/users.ts, so this is both the correct match and the
  // indexed one.
  const account = await findAccountForSignIn(email);

  const matches = await verifyPassword(
    password,
    account?.passwordHash ?? (await absentUserHash()),
  );
  if (!account || !matches) return fail("unauthenticated", NO_MATCH);

  const { token, expiresAt } = await createSession(
    account.user.id,
    request.headers.get("user-agent") ?? undefined,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Not `true` unconditionally: development runs on http://localhost, where a
    // secure cookie is dropped by the browser without a word. The symptom is a
    // 200 here and a signed-out page immediately after, with nothing logged.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return json(account.user);
});
