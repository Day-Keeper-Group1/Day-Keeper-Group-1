import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/contract/api";
import { fail, json, route } from "@/server/api/respond";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { SESSION_COOKIE_NAME, createSession } from "@/server/auth/session";
import { transaction } from "@/server/db";

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

/** Postgres unique-violation. Here it means the email is already registered. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

type NewUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: SessionUser["role"];
  timezone: string;
};

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
  let user: NewUserRow;
  try {
    user = await transaction(async (client) => {
      const inserted = await client.query<NewUserRow>(
        `INSERT INTO users (email, display_name, password_hash)
              VALUES ($1, $2, $3)
           RETURNING id, email, display_name, role, timezone`,
        [email, displayName, passwordHash],
      );
      const row = inserted.rows[0];

      await client.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id)
              VALUES ($1, 'user.register', 'user', $1)`,
        [row.id],
      );

      return row;
    });
  } catch (error) {
    // Asking first and inserting second reads more naturally and is wrong: two
    // registrations racing on the same address both pass the check, and one
    // then fails here anyway with nobody having written a message for it.
    if (isUniqueViolation(error)) {
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

  const session: SessionUser = {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    timeZone: user.timezone,
  };
  return json(session, 201);
});
