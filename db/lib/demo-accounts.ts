// KAN-86: empty one demonstration account, or give Margaret this week's letters.

/**
 * What one account holds, changed without touching any other.
 *
 * Migrations change what the tables are; this changes what is in them for one
 * account. Two things:
 *
 * - clear: remove one account's letters, tasks, reminders and photographs.
 *   The account stays, so does its password and whoever is signed in to it,
 *   and so does its audit log: the school key's daily ceiling counts those
 *   lines (src/server/ai/school-key.ts), and clearing an account must not hand
 *   it a fresh day's allowance.
 * - refresh Margaret: clear her, then plant the demonstration list
 *   (db/demo/margaret.json) with its dates counted from today.
 *
 * Only accounts at @example.com, which are the ones the seed makes. That rule
 * is the guard, and it replaces the "is this database local?" guard the
 * destructive scripts have: this is meant to run against the deployed
 * database, from the Demo accounts workflow, and an account somebody
 * registered with a real address is never touched, wherever it is.
 *
 * The bucket is handed in, as the seed's is, so the tests need none.
 *
 * Nothing here is run directly: db/demo-accounts.ts is the command.
 */

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { Db } from "../../src/server/db/client";
import { documents, tasks, users } from "../../src/server/db/schema";
import { readDemoList, type DemoLetter } from "./demo-list";
import { MARGARET_EMAIL, plantLetters, type StorePage } from "./seed-world";

/** The only addresses this will change. */
export const DEMO_DOMAIN = "@example.com";

/** What the bucket has to do for this file. */
export type ObjectStore = {
  /** Store one page, as the seed does. */
  put: StorePage;
  /** Every key under a prefix. */
  list: (prefix: string) => Promise<string[]>;
  /** Delete these keys. */
  remove: (keys: string[]) => Promise<void>;
};

/** A request this file will not carry out, with the sentence that says why. */
export class AccountRefused extends Error {}

/** What a clear removed. */
export type Cleared = { letters: number; tasks: number; photographs: number };

/** The address as the database stores it, or AccountRefused when it is not a demonstration account. */
export function demoAccount(email: string | undefined): string {
  const canonical = (email ?? "").trim().toLowerCase();
  if (canonical === "") {
    throw new AccountRefused(
      "Say which account to clear, for example hiruni@example.com.",
    );
  }
  if (!canonical.endsWith(DEMO_DOMAIN)) {
    throw new AccountRefused(
      `${canonical} is not a demonstration account. Only addresses ending ` +
        `${DEMO_DOMAIN}, the ones the seed makes, can be cleared: an account ` +
        "somebody registered with a real address is theirs.",
    );
  }
  return canonical;
}

async function accountId(db: Db, email: string): Promise<string> {
  const [found] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailCanonical, email));
  if (!found) {
    throw new AccountRefused(
      `There is no account ${email} in this database. The seeded ones are ` +
        "margaret@example.com, operator@example.com and one per teammate " +
        "(db/lib/seed-world.ts, TEAM).",
    );
  }
  return found.id;
}

/**
 * Remove one account's letters and tasks. Reminders go with their tasks, and
 * pages, fields and readings with their letters (the foreign keys cascade).
 * Tasks are removed by owner and not through the letters, because a task
 * outlives its letter: that key sets null.
 */
async function removeRows(
  tx: Db,
  userId: string,
): Promise<{ letters: number; tasks: number }> {
  const goneTasks = await tx
    .delete(tasks)
    .where(eq(tasks.userId, userId))
    .returning({ id: tasks.id });
  const goneLetters = await tx
    .delete(documents)
    .where(eq(documents.userId, userId))
    .returning({ id: documents.id });
  return { letters: goneLetters.length, tasks: goneTasks.length };
}

/** Where an account's photographs are (src/server/storage.ts, uploadObjectKey). */
const photographsOf = (userId: string) => `uploads/${userId}/`;

/**
 * Empty one demonstration account.
 *
 * The rows go first, in one transaction, and the photographs after it has
 * committed. A photograph whose row is gone costs nothing; a row whose
 * photograph is gone draws as a broken image.
 */
export async function clearAccount(
  db: NodePgDatabase,
  email: string | undefined,
  store: ObjectStore,
): Promise<Cleared> {
  const address = demoAccount(email);
  const { userId, removed } = await db.transaction(async (tx) => {
    const userId = await accountId(tx, address);
    return { userId, removed: await removeRows(tx, userId) };
  });
  const keys = await store.list(photographsOf(userId));
  await store.remove(keys);
  return { ...removed, photographs: keys.length };
}

/**
 * Margaret, with this week's letters and nothing else.
 *
 * Her old photographs are listed before anything changes and deleted after
 * the new letters have committed: the new ones go under new ids, so the list
 * holds exactly the old ones. If planting fails, the transaction puts her old
 * letters back and the old photographs are still there for them.
 */
export async function refreshMargaret(
  db: NodePgDatabase,
  store: ObjectStore,
  list: DemoLetter[] = readDemoList(),
): Promise<{ removed: Cleared; planted: number }> {
  const userId = await accountId(db, MARGARET_EMAIL);
  const oldKeys = await store.list(photographsOf(userId));

  const { removed, planted } = await db.transaction(async (tx) => {
    const removed = await removeRows(tx, userId);
    const planted = await plantLetters(tx, store.put, userId, list);
    return { removed, planted: planted.length };
  });

  await store.remove(oldKeys);
  return { removed: { ...removed, photographs: oldKeys.length }, planted };
}
