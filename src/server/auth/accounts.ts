// KAN-92: registering an account and finding one at sign in, behind two functions.

/**
 * Accounts.
 *
 * ./session.ts answers who is asking once somebody has signed in. This file is
 * the step before that: making a person, and finding the person an address
 * belongs to so that a password can be checked against them. The register and
 * login routes call these two functions and keep only what is HTTP: reading
 * the body, the sentences they answer with, the cookie.
 *
 * The password itself is not handled here. A route hashes it, or checks it
 * against the hash this file hands back (./password.ts), so nothing below ever
 * holds a password a person typed.
 */

import "server-only";
import type { SessionUser } from "@/lib/contract/api";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { insertAuditLog } from "@/server/db/queries/audit";
import { findActiveUserByEmail, insertUser } from "@/server/db/queries/users";
import { mapSessionUser } from "./session";

/** The address is already registered. The register route answers 409 with its own sentence. */
export class EmailTaken extends Error {}

/**
 * The active account for an address as typed at sign in, with the hash to
 * check the password against.
 *
 * The hash is handed back beside the person and not inside them, so the
 * `user` a route goes on to answer with has never had it.
 */
export async function findAccountForSignIn(
  emailCanonical: string,
): Promise<{ user: SessionUser; passwordHash: string } | null> {
  const row = await findActiveUserByEmail(db(), emailCanonical);
  if (!row) return null;
  return { user: mapSessionUser(row), passwordHash: row.passwordHash };
}

/** Create a person and the audit line that says so, as one unit. Throws EmailTaken. */
export async function registerAccount(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<SessionUser> {
  try {
    return await db().transaction(async (tx) => {
      const user = await insertUser(tx, input);
      await insertAuditLog(tx, {
        actorId: user.id,
        action: "user.register",
        targetType: "user",
        targetId: user.id,
      });
      return mapSessionUser(user);
    });
  } catch (error) {
    // Asking first and inserting second reads more naturally and is wrong: two
    // registrations racing on the same address both pass the check, and one
    // then fails here anyway with nobody having written a message for it.
    if (isUniqueViolation(error)) throw new EmailTaken();
    throw error;
  }
}
