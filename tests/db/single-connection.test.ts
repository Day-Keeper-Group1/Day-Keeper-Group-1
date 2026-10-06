// KAN-92: everything a person does, on a pool of one connection, which is what the deployed app has.

/**
 * One connection.
 *
 * On a laptop the app's pool holds ten connections. Deployed, every copy of
 * the app holds one (poolOptions in src/server/db/client.ts). A statement sent
 * to `db()` from inside a transaction then asks the pool for a second
 * connection while the transaction is holding the only one: it waits until
 * the connect timeout runs out, and fails. With ten connections the same
 * mistake finds a second one and nothing notices, so no other file under
 * tests/db can see it.
 *
 * So this file hands the app a pool of one before anything has asked for the
 * handle, and then walks through what a person does: register, send a letter,
 * have it read in two rounds, have another letter fail, save, tick, untick,
 * and look at every screen. That passes through all six transactions, and
 * through every place where several statements are sent at once. All of it
 * has to finish.
 *
 * The last test sends a statement the wrong way on purpose. It is the control:
 * it shows that this pool is one the walk would not have got through, had any
 * statement in it been sent to `db()` where `tx` was meant.
 *
 * The bucket and the model are stand-ins (./support/fakes.ts).
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/server/storage", async (importActual) =>
  (await import("./support/fakes")).memoryStorage(importActual),
);
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { registerAccount } from "@/server/auth/accounts";
import { hashPassword } from "@/server/auth/password";
import { confirmDocument } from "@/server/confirm";
import { db } from "@/server/db";
import { createDb } from "@/server/db/client";
import { dbCause } from "@/server/db/errors";
import { countOwnedDocumentsToCheck } from "@/server/db/queries/documents";
import {
  getDocument,
  getHome,
  getPageStoragePath,
  listDocuments,
} from "@/server/documents";
import { ExtractionFailure } from "@/server/extraction";
import { completeTask, getTask, listTasks, reopenTask } from "@/server/tasks";
import {
  continueReadings,
  createDocument,
  readDocument,
} from "@/server/uploads";

import { answersLeft, readerAnswers, resetFakes } from "./support/fakes";
import { rows } from "./support/witness";
import { PASSWORD, aPerson, aReading, photographsOf } from "./support/world";

const MELBOURNE = "Australia/Melbourne";

/** How long this pool waits for a connection before it gives up. The app's own waits ten seconds. */
const CONNECT_TIMEOUT_MS = 2_000;

/**
 * A bill, due far enough ahead that all three reminders are still to come.
 *
 * It prints a number, and the walk needs it to. Writing a reading is four
 * statements in one transaction, and the one that writes the numbers returns
 * without sending anything when a letter prints none. A walk whose letters
 * printed no number would never ask this pool for that statement's connection.
 */
const BILL = aReading(
  {
    document_type: "Utility bill",
    issuer: "Example Energy",
    action_required: "Pay Example Energy",
    due_date: "2099-03-15",
    due_time: "10:30",
    amount: "$347.60",
    reference: "4417 2290 113",
  },
  [{ label: "Account number", value: "4417 2290 113" }],
);

/** The same bill read with another reference. Three of these never agree, so the round they are read in decides nothing. */
const billWithReference = (reference: string) =>
  aReading({
    document_type: "Utility bill",
    issuer: "Example Energy",
    action_required: "Pay Example Energy",
    due_date: "2099-03-15",
    due_time: "10:30",
    amount: "$347.60",
    reference,
  });

/** Every letter in the order it was sent: its status, and the status of each of its rounds in the order they were read. */
function lettersAndRounds() {
  return rows<{ status: string; rounds: string[] }>(
    `SELECT d.status,
            (SELECT array_agg(r.status::text ORDER BY r.started_at, r.id)
               FROM extraction_runs r
              WHERE r.document_id = d.id) AS rounds
       FROM documents d
      ORDER BY d.uploaded_at, d.id`,
  );
}

describe("the app on one connection", () => {
  /** The first thing each call of console.error was given. */
  let logged: string[];

  beforeAll(() => {
    // ./support/setup.ts has made this file's database and has not touched the
    // app's handle. The pool the app would have built for itself is put there
    // first, with room for one connection. Setup ends it and forgets it after
    // the last test, like any pool the app made.
    const app = globalThis as unknown as { __daykeeperDb?: unknown };
    if (app.__daykeeperDb) {
      throw new Error(
        "Something asked for db() before this file could hand it a pool of one.",
      );
    }
    app.__daykeeperDb = createDb(process.env.DATABASE_URL!, {
      max: 1,
      connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    });
  });

  beforeEach(() => {
    resetFakes();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gets through everything a person does", async () => {
    // Register: the person and the audit line about her, one transaction.
    const margaret = await registerAccount({
      email: "margaret@example.com",
      displayName: "Margaret",
      passwordHash: await hashPassword(PASSWORD),
    });

    // Send a letter: the letter, its page and its queued round, one
    // transaction.
    const letter = (
      await createDocument(margaret.id, MELBOURNE, photographsOf(1))
    ).id;

    // Read it. The two reader calls are made at once and each writes its own
    // row. The three readings differ, so the round is closed and the next one
    // queued: one transaction.
    readerAnswers(
      billWithReference("REF 1"),
      billWithReference("REF 2"),
      billWithReference("REF 3"),
    );
    await readDocument(letter, margaret.id, photographsOf(1), { pauseMs: 0 });
    expect(await lettersAndRounds()).toEqual([
      { status: "processing", rounds: ["failed", "queued"] },
    ]);

    // A second letter, whose reader fails in a way trying again would not
    // mend. The failure is written on the round and on the letter: one
    // transaction.
    const unreadable = (
      await createDocument(margaret.id, MELBOURNE, photographsOf(1))
    ).id;
    const noKey = () =>
      new ExtractionFailure("the reader has no key", { retryable: false });
    readerAnswers(noKey(), noKey());
    await readDocument(unreadable, margaret.id, photographsOf(1));
    expect(logged).toEqual([
      `[uploads] reading document ${unreadable} failed: reader 1, attempt 1 of 3`,
      `[uploads] reading document ${unreadable} failed: reader 2, attempt 1 of 3`,
    ]);
    logged.length = 0;

    // A third letter, sent and not read yet.
    const waiting = (
      await createDocument(margaret.id, MELBOURNE, photographsOf(1))
    ).id;

    // The poll reads every queued round at once, each from its photograph in
    // the bucket: the second round of the first letter and the first round of
    // the third. Both are decided, and each reading is written as one
    // transaction, the two of them side by side: the round, its fields, the
    // number the bill prints, and the letter.
    readerAnswers(BILL, BILL, BILL, BILL);
    await continueReadings(margaret.id);
    expect(await lettersAndRounds()).toEqual([
      { status: "needs-review", rounds: ["failed", "succeeded"] },
      { status: "failed", rounds: ["failed"] },
      { status: "needs-review", rounds: ["succeeded"] },
    ]);
    // The statement that writes the numbers was sent, once for each reading.
    expect(
      await rows("SELECT count(*)::integer AS n FROM extracted_identifiers"),
    ).toEqual([{ n: 2 }]);

    // Save it: the lock, the task, its reminders, the mark and the audit line,
    // one transaction, and the task read back after it.
    const saved = await confirmDocument(letter, margaret.id, MELBOURNE);
    const task = saved!.task!.id;
    expect(saved?.task?.reminders).toHaveLength(3);

    // Tick, and untick.
    expect((await completeTask(task, margaret.id, MELBOURNE))?.status).toBe(
      "completed",
    );
    expect((await reopenTask(task, margaret.id, MELBOURNE))?.status).toBe(
      "upcoming",
    );

    // Every screen. Home, one letter and one task each send three statements
    // at once.
    const home = await getHome(margaret.id, MELBOURNE);
    expect(home.counts).toEqual({ needsReview: 1, processing: 0, failed: 1 });
    expect(home.tasks.map((row) => row.id)).toEqual([task]);
    expect(await listDocuments(margaret.id, MELBOURNE)).toHaveLength(3);
    expect(
      (await getDocument(waiting, margaret.id, MELBOURNE))?.fields,
    ).toHaveLength(7);
    expect(await getPageStoragePath(letter, 1, margaret.id)).toBe(
      `uploads/${margaret.id}/${letter}/1.png`,
    );
    expect(await listTasks(margaret.id, MELBOURNE)).toHaveLength(1);
    expect((await getTask(task, margaret.id, MELBOURNE))?.pageCount).toBe(1);

    // Nothing waited for a connection it could not have, and every scripted
    // answer was asked for.
    expect(logged).toEqual([]);
    expect(answersLeft()).toBe(0);
  });

  it("stops a statement sent to db() from inside a transaction, when the wait for a connection runs out", async () => {
    const margaret = await aPerson("Margaret");

    const started = Date.now();
    const wrong = await db()
      .transaction(async () =>
        // The mistake: `db()` where the transaction's own `tx` was meant.
        countOwnedDocumentsToCheck(db(), margaret.id),
      )
      .catch((error: unknown) => error);
    const waited = Date.now() - started;

    // What the pool says when no connection came free in time.
    expect(dbCause(wrong)).toMatchObject({
      message: "timeout exceeded when trying to connect",
    });
    // It waited this pool's two seconds, not the ten the app's own pool waits.
    expect(waited).toBeGreaterThanOrEqual(CONNECT_TIMEOUT_MS - 100);
    expect(waited).toBeLessThan(10_000);

    // The transaction was rolled back and gave its connection back: the next
    // statement is answered.
    expect(await countOwnedDocumentsToCheck(db(), margaret.id)).toBe(0);
  });
});
