// KAN-86: clearing one demonstration account, and refreshing Margaret, against a real PostgreSQL.

/**
 * db/lib/demo-accounts.ts, the logic behind the Demo accounts button.
 *
 * The seed plants its world first, so every account the deployed site has is
 * here. Hiruni is then given a letter of her own, so that "nobody else is
 * touched" has something in another account to be measured against.
 *
 * The bucket is a set of keys in memory: what was put, what is listed, what
 * was removed. The tables are read through the witness, which sees them as they are.
 */

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { addDays, todayInZone } from "@/lib/contract/dates";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

import {
  AccountRefused,
  clearAccount,
  refreshMargaret,
  type ObjectStore,
} from "../../db/lib/demo-accounts";
import { readDemoList } from "../../db/lib/demo-list";
import { plantLetters, seedWorld } from "../../db/lib/seed-world";
import { rows } from "./support/witness";

/** The stand-in bucket: every key it holds. */
let bucket: Set<string>;
/** Every key the code under test asked to remove, in order. */
let removed: string[];

const store: ObjectStore = {
  put: async ({ key }) => {
    bucket.add(key);
    return 1234;
  },
  list: async (prefix) => [...bucket].filter((key) => key.startsWith(prefix)),
  remove: async (keys) => {
    removed.push(...keys);
    for (const key of keys) bucket.delete(key);
  },
};

async function idOf(email: string): Promise<string> {
  const [found] = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailCanonical, email));
  return found.id;
}

/** How many letters and tasks each account holds, by address. */
async function holdings(): Promise<
  Record<string, { letters: number; tasks: number }>
> {
  const people = await rows("select * from users");
  const letters = await rows("select * from documents");
  const tasks = await rows("select * from tasks");
  return Object.fromEntries(
    people.map((person) => [
      person.email as string,
      {
        letters: letters.filter((row) => row.user_id === person.id).length,
        tasks: tasks.filter((row) => row.user_id === person.id).length,
      },
    ]),
  );
}

const keysUnder = (userId: string) =>
  [...bucket].filter((key) => key.startsWith(`uploads/${userId}/`));

let margaret: string;
let hiruni: string;

beforeEach(async () => {
  bucket = new Set();
  removed = [];
  await seedWorld(db(), store.put);
  margaret = await idOf("margaret@example.com");
  hiruni = await idOf("hiruni@example.com");
  // One letter of Hiruni's own: the first of the list, under her account.
  await db().transaction((tx) =>
    plantLetters(tx, store.put, hiruni, readDemoList().slice(0, 1)),
  );
});

describe("clearing one account", () => {
  it("removes that account's letters, tasks and photographs, and nobody else's", async () => {
    const before = await holdings();
    const margaretsKeys = keysUnder(margaret);
    const hirunisKeys = keysUnder(hiruni);

    const gone = await clearAccount(db(), " Hiruni@Example.com ", store);

    expect(gone).toEqual({
      letters: 1,
      tasks: 1,
      photographs: hirunisKeys.length,
    });
    const after = await holdings();
    expect(after["hiruni@example.com"]).toEqual({ letters: 0, tasks: 0 });
    expect({ ...after, "hiruni@example.com": undefined }).toEqual({
      ...before,
      "hiruni@example.com": undefined,
    });
    expect(removed.sort()).toEqual([...hirunisKeys].sort());
    expect(keysUnder(margaret)).toEqual(margaretsKeys);
  });

  it("keeps the account itself and its audit lines", async () => {
    const auditBefore = (await rows("select * from audit_logs")).length;

    await clearAccount(db(), "hiruni@example.com", store);

    expect(await idOf("hiruni@example.com")).toBe(hiruni);
    expect((await rows("select * from audit_logs")).length).toBe(auditBefore);
  });

  it("refuses an address that is not a demonstration account, and changes nothing", async () => {
    await db()
      .update(users)
      .set({ email: "hiruni@rmit.edu.au" })
      .where(eq(users.id, hiruni));
    const before = await holdings();

    await expect(
      clearAccount(db(), "hiruni@rmit.edu.au", store),
    ).rejects.toThrow(AccountRefused);
    await expect(clearAccount(db(), "", store)).rejects.toThrow(AccountRefused);

    expect(await holdings()).toEqual(before);
    expect(removed).toEqual([]);
  });

  it("says so when there is no such account", async () => {
    await expect(
      clearAccount(db(), "nobody@example.com", store),
    ).rejects.toThrow(/There is no account nobody@example.com/);
  });
});

describe("refreshing Margaret", () => {
  it("replaces her letters with the list's, dated from today, and touches nobody else", async () => {
    const before = await holdings();
    const oldLetters = (await rows("select * from documents"))
      .filter((row) => row.user_id === margaret)
      .map((row) => row.id);
    const oldKeys = keysUnder(margaret);

    const result = await refreshMargaret(db(), store);

    const list = readDemoList();
    expect(result.planted).toBe(list.length);
    expect(result.removed.letters).toBe(oldLetters.length);
    expect(removed.sort()).toEqual([...oldKeys].sort());

    const letters = (await rows("select * from documents")).filter(
      (row) => row.user_id === margaret,
    );
    expect(letters).toHaveLength(list.length);
    expect(letters.some((row) => oldLetters.includes(row.id))).toBe(false);
    expect(keysUnder(margaret).length).toBeGreaterThan(0);
    expect(keysUnder(margaret).every((key) => !oldKeys.includes(key))).toBe(
      true,
    );

    const after = await holdings();
    expect({ ...after, "margaret@example.com": undefined }).toEqual({
      ...before,
      "margaret@example.com": undefined,
    });

    // The first letter of the list is due the number of days it says, from
    // today in Melbourne.
    const first = list[0];
    if (!("dueInDays" in first))
      throw new Error("the list starts with a due letter");
    // As text: the driver turns a date into a JavaScript Date at local
    // midnight, which is not the day it was in Melbourne.
    const dueDates = (
      await rows<{ due: string }>(
        "select to_char(due_date, 'YYYY-MM-DD') as due from tasks where user_id = $1",
        [margaret],
      )
    ).map((row) => row.due);
    expect(dueDates).toContain(
      addDays(todayInZone("Australia/Melbourne"), first.dueInDays),
    );
  });
});
