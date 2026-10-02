// KAN-92: every statement about people and their sessions.

/**
 * People and sessions: the statements.
 *
 * The tables are declared in ../schema/users.ts, and this file, named like it,
 * holds every statement the app runs against them. The rules stay with the
 * callers: src/server/auth/session.ts answers who is asking, and
 * src/server/auth/accounts.ts registers a person and finds one at sign in.
 *
 * Every function takes the handle first, `db()` or a `tx`, and none opens a
 * transaction: src/server/db/AGENTS.md, rules 1 to 3.
 *
 * No function in this file is scoped by a user id, because these are the
 * statements that find out who the user is. Each one that reads or changes
 * rows that are already there says why under "Unscoped on purpose".
 */

import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../client";
import { sessions, users } from "../schema";
import { dbNow } from "../sql";

/** What the app carries around about a person. The password hash is not in it. */
const sessionUserColumns = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  timezone: users.timezone,
};

/** A person as these statements answer them; mapSessionUser() in src/server/auth/session.ts turns one into what the browser receives. */
export type SessionUserRow = NonNullable<
  Awaited<ReturnType<typeof touchSessionAndFindUser>>
>;

/**
 * The active account under an address, with the hash its password is checked
 * against. Null when there is none, or when it has been deactivated.
 *
 * `emailCanonical` is the address trimmed and in lower case, which is what the
 * email_canonical column holds, so this is both the correct match and the
 * indexed one.
 *
 * Unscoped on purpose: this is sign in. Nobody is signed in yet, and the
 * address is all there is to look a person up by.
 */
export async function findActiveUserByEmail(db: Db, emailCanonical: string) {
  const rows = await db
    .select({ ...sessionUserColumns, passwordHash: users.passwordHash })
    .from(users)
    .where(
      and(
        eq(users.emailCanonical, emailCanonical),
        isNull(users.deactivatedAt),
      ),
    );
  return rows[0] ?? null;
}

/**
 * A new person. The address is stored as it was typed; the role and the time
 * zone are the ones the database gives every new account. An address that is
 * already registered is refused by the unique index on email_canonical.
 */
export async function insertUser(
  db: Db,
  person: { email: string; displayName: string; passwordHash: string },
) {
  const [row] = await db
    .insert(users)
    .values({
      email: person.email,
      displayName: person.displayName,
      passwordHash: person.passwordHash,
    })
    .returning(sessionUserColumns);
  return row;
}

/** A session for a person who has just proved who they are. The hash of the token is stored, never the token. */
export async function insertSession(
  db: Db,
  session: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
  },
): Promise<void> {
  await db.insert(sessions).values({
    userId: session.userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    userAgent: session.userAgent,
  });
}

/**
 * Who a session token belongs to, or null.
 *
 * One statement does everything: finds the session by token hash, checks it
 * has not expired, checks the account is still active, stamps last_seen_at,
 * and returns the user. Atomic, one round trip, nothing to keep in step. It
 * does not move expires_at: using a session does not extend it.
 *
 * Unscoped on purpose: the token hash is the scope. It identifies one session
 * of one person, and the person is what this statement is asked for.
 */
export async function touchSessionAndFindUser(db: Db, tokenHash: string) {
  const rows = await db
    .update(sessions)
    .set({ lastSeenAt: dbNow })
    .from(users)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, dbNow),
        eq(users.id, sessions.userId),
        isNull(users.deactivatedAt),
      ),
    )
    .returning(sessionUserColumns);
  return rows[0] ?? null;
}

/**
 * End the session a token opened.
 *
 * Unscoped on purpose: the token hash is the scope, as above. Only the browser
 * holding the token can name its row.
 */
export async function deleteSessionByTokenHash(
  db: Db,
  tokenHash: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
