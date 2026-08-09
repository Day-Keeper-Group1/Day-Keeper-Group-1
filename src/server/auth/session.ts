/**
 * The authentication seam.
 *
 * ADR 002's whole promise is that "who is asking?" is answered in exactly one
 * place. This is the place. Route handlers call `requireUser()` (or
 * `getCurrentUser()` when signed-out is a legal state) and never look at the
 * cookie, the sessions table, or the users table themselves. If five handlers
 * each grew their own version of this lookup, the five would drift, and the
 * drift would be a security hole.
 *
 * What is deliberately NOT here: the auth route handlers themselves
 * (register, login, logout, me). They are specified in docs/api.md and are
 * ordinary tickets. This module is only the part everyone else depends on,
 * provided early so no ticket has to wait for the sign-in ticket.
 *
 * The session model, from ADR 002: a random token in an httpOnly cookie, its
 * SHA-256 in the sessions table, one row per signed-in browser. Deleting the
 * row signs out everywhere, immediately.
 */

import "server-only";
import { cookies } from "next/headers";
import { queryOne } from "../db";
import type { SessionUser } from "@/lib/contract/api";
import { generateSessionToken, hashSessionToken } from "./token";

/** The cookie's name, shared with the login/logout handlers that set and clear it. */
export const SESSION_COOKIE_NAME = "dk_session";

/** How long a session lives without being renewed. */
export const SESSION_TTL_DAYS = 30;

/**
 * Thrown by requireUser. Route handlers map it to a 401 ApiError; nothing else
 * should throw it. Carrying the status here keeps the mapping mechanical.
 */
export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor() {
    super("Please sign in.");
    this.name = "UnauthenticatedError";
  }
}

/**
 * Open a session for a user who has just proved who they are.
 *
 * Returns the plaintext token and its expiry; setting the cookie is the login
 * handler's job:
 *
 *   cookieStore.set(SESSION_COOKIE_NAME, token, {
 *     httpOnly: true, sameSite: 'lax', secure: true, path: '/', expires: expiresAt,
 *   })
 */
export async function createSession(
  userId: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await queryOne(
    `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [userId, hashSessionToken(token), expiresAt, userAgent ?? null],
  );
  return { token, expiresAt };
}

/**
 * Who is asking? Null when nobody is: signed out is a state, not an error.
 *
 * One statement does everything: finds the session by token hash, checks it
 * has not expired, checks the account is still active, stamps last_seen_at,
 * and returns the user. Atomic, one round trip, nothing to keep in step.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const row = await queryOne<{
    id: string;
    email: string;
    display_name: string;
    role: SessionUser["role"];
    timezone: string;
  }>(
    `UPDATE sessions s SET last_seen_at = now()
       FROM users u
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND u.id = s.user_id
        AND u.deactivated_at IS NULL
      RETURNING u.id, u.email, u.display_name, u.role, u.timezone`,
    [hashSessionToken(token)],
  );
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    timeZone: row.timezone,
  };
}

/**
 * Who is asking, or a 401.
 *
 * The shape every protected handler starts with:
 *
 *   const user = await requireUser();          // throws UnauthenticatedError
 *   ...WHERE user_id = $1 with user.id...      // never a query without it
 *
 * and in the handler's catch:
 *
 *   if (e instanceof UnauthenticatedError) return 401 with code 'unauthenticated'
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/**
 * End the current session everywhere. Deleting the row is what signs out; the
 * logout handler should also clear the cookie, but even a browser that keeps
 * the cookie now holds a token that opens nothing.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return;
  await queryOne(`DELETE FROM sessions WHERE token_hash = $1`, [
    hashSessionToken(token),
  ]);
}
