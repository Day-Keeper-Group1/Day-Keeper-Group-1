import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/contract/api";
import { fail, json, route } from "@/server/api/respond";
import { EmailTaken, registerAccount } from "@/server/auth/accounts";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { SESSION_COOKIE_NAME, createSession } from "@/server/auth/session";

/**
 * POST /api/auth/register — create a person, and sign them in.
 *
 * Spec: docs/api.md, "Create an account".
 */

/** Enough to catch a typo, not an attempt to implement RFC 5322. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The longest address the standard allows. */
const MAX_EMAIL = 254;
const MAX_DISPLAY_NAME = 100;

export const POST = route(async (request: Request) => {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
  } | null;

  if (!body || typeof body !== "object") {
    return fail("invalid_request", "Please send your details to sign up.");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";

  const fields: Record<string, string> = {};

  if (!displayName) {
    fields.displayName = "Please enter your name.";
  } else if (displayName.length > MAX_DISPLAY_NAME) {
    fields.displayName = "That name is too long.";
  }

  if (!email) {
    fields.email = "Please enter your email address.";
  } else if (email.length > MAX_EMAIL || !LOOKS_LIKE_EMAIL.test(email)) {
    fields.email = "Please check that email address.";
  }

  // The only opinion about passwords in the project, and it explains itself
  // where it lives. Restating a rule here would give us two that can drift.
  const passwordProblem = !password
    ? "Please choose a password."
    : validatePasswordStrength(password);
  if (passwordProblem) fields.password = passwordProblem;

  if (Object.keys(fields).length > 0) {
    return fail("invalid_request", "Please check the details below.", fields);
  }

  const passwordHash = await hashPassword(password);

  // The address is stored as she typed it. Matching is done against
  // email_canonical, a generated lower(btrim(email)) column with a unique index
  // on it, so " Margaret.W@Example.COM " and "margaret.w@example.com" are the
  // same account while the capitals she chose survive on her own screen.
  let user: SessionUser;
  try {
    user = await registerAccount({ email, displayName, passwordHash });
  } catch (error) {
    if (error instanceof EmailTaken) {
      return fail(
        "conflict",
        "There is already an account with that email address.",
      );
    }
    throw error;
  }

  const { token, expiresAt } = await createSession(
    user.id,
    request.headers.get("user-agent") ?? undefined,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Same reason as the login handler: a secure cookie is dropped without a
    // word over http://localhost, and the symptom is a signed-out page after a
    // successful response.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return json(user, 201);
});
