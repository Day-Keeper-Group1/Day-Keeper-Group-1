// KAN-92: every way the app changes a row moves its updated_at, with no trigger to do it.

/**
 * updated_at.
 *
 * Three tables carry updated_at: users, documents and tasks. The column sets
 * itself, on every UPDATE sent through the query builder (updatedAt in
 * src/server/db/schema/columns.ts), and nothing in the database does: there
 * is no trigger. A statement that reached the database any other way would
 * leave a row saying it has not changed since the day it was made, and
 * nothing would fail.
 *
 * So every way the app changes a row of those tables runs here, on a row whose
 * updated_at was first moved an hour into the past, and afterwards the column
 * has to say now, by the database's clock. A second row of the same person is
 * made old beside it and has to stay old: the statement moved the row it
 * changed and no other.
 *
 * The ways, and the statement behind each (src/server/db/queries/):
 *
 *   a reading landing                      writeReadingOntoOwnedDocument
 *   a reading failing                      markOwnedDocumentFailed, in a transaction
 *   photographs that cannot be fetched     markOwnedDocumentFailed, on its own
 *   saving a letter                        markOwnedDocumentConfirmed
 *   ticking a task                         completeOwnedTaskRows
 *   unticking a task                       reopenOwnedTaskRows
 *
 * The app has no statement that changes a person yet. The column on users is
 * held to the same rule by an UPDATE written here with the builder, so that
 * the first statement that does change a person starts from a column known to
 * work.
 *
 * Whose clock says now is the last thing held here. The column is stamped
 * with the database's `now()`, not with the clock of whichever copy of the
 * app sent the statement, and on one machine the two agree. So one test moves
 * the app's clock to 2001 while it changes a row of each table.
 *
 * The bucket and the model are stand-ins (./support/fakes.ts).
 */

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/storage", async (importActual) =>
  (await import("./support/fakes")).memoryStorage(importActual),
);
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { confirmDocument } from "@/server/confirm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { ExtractionFailure } from "@/server/extraction";
import { uploadObjectKey } from "@/server/storage";
import { completeTask, reopenTask } from "@/server/tasks";
import { readDocument, readStoredDocument } from "@/server/uploads";

import {
  readerAnswers,
  resetFakes,
  withTheAppClockIn2001,
} from "./support/fakes";
import { backdate, rows } from "./support/witness";
import {
  aConfirmedLetter,
  aLetterToCheck,
  aPerson,
  aQueuedLetter,
  aReading,
  photographsOf,
  type Person,
} from "./support/world";

const MELBOURNE = "Australia/Melbourne";

/** A bill, due far enough ahead that saving it makes a task with reminders. */
const BILL = aReading({
  document_type: "Utility bill",
  issuer: "Example Energy",
  action_required: "Pay Example Energy",
  due_date: "2099-03-15",
  amount: "$347.60",
  reference: "Not applicable",
});

/** A form to send back, which becomes a second task. */
const FORM = aReading({
  document_type: "Concession form",
  issuer: "Harbour Water",
  action_required: "Return form to Harbour Water",
  due_date: "2099-02-03",
  amount: "No payment required",
  reference: "Not applicable",
});

type Table = "users" | "documents" | "tasks";

/** Whether a row says it changed within the last minute, by the database's clock. */
async function changedJustNow(table: Table, id: string): Promise<boolean> {
  const [row] = await rows<{ justNow: boolean }>(
    `SELECT updated_at > now() - interval '1 minute' AS "justNow"
       FROM ${table} WHERE id = $1`,
    [id],
  );
  return row.justNow;
}

/** Make a row say it last changed an hour ago, and see that it does. */
async function madeAnHourOld(table: Table, id: string): Promise<void> {
  await backdate(table, "updated_at", id, "1 hour");
  expect(await changedJustNow(table, id)).toBe(false);
}

/** What a letter's status is now. */
async function statusOf(letter: string): Promise<string> {
  const [stored] = await rows<{ status: string }>(
    "SELECT status FROM documents WHERE id = $1",
    [letter],
  );
  return stored.status;
}

/** What a task's tick is now. */
async function stateOf(task: string): Promise<string> {
  const [stored] = await rows<{ state: string }>(
    "SELECT state FROM tasks WHERE id = $1",
    [task],
  );
  return stored.state;
}

describe("updated_at", () => {
  let margaret: Person;
  /** The first thing each call of console.error was given. */
  let logged: string[];

  beforeEach(async () => {
    resetFakes();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
    margaret = await aPerson("Margaret");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("on a letter", () => {
    /** A letter waiting to be read, and another beside it, both an hour old. */
    async function twoOldLetters() {
      const letter = await aQueuedLetter(margaret);
      const bystander = await aQueuedLetter(margaret);
      await madeAnHourOld("documents", letter);
      await madeAnHourOld("documents", bystander);
      return { letter, bystander };
    }

    it("is moved by a reading landing", async () => {
      const { letter, bystander } = await twoOldLetters();

      readerAnswers(BILL, BILL);
      await readDocument(letter, margaret.id, photographsOf(1));

      expect(await statusOf(letter)).toBe("needs-review");
      expect(await changedJustNow("documents", letter)).toBe(true);
      expect(await changedJustNow("documents", bystander)).toBe(false);
      expect(logged).toEqual([]);
    });

    it("is moved by a reading failing", async () => {
      const { letter, bystander } = await twoOldLetters();
      const noKey = () =>
        new ExtractionFailure("the reader has no key", { retryable: false });

      readerAnswers(noKey(), noKey());
      await readDocument(letter, margaret.id, photographsOf(1));

      expect(await statusOf(letter)).toBe("failed");
      expect(await changedJustNow("documents", letter)).toBe(true);
      expect(await changedJustNow("documents", bystander)).toBe(false);
      expect(logged).toEqual([
        `[uploads] reading document ${letter} failed: reader 1, attempt 1 of 3`,
        `[uploads] reading document ${letter} failed: reader 2, attempt 1 of 3`,
      ]);
    });

    // The letter is failed with no round to write the failure on, by the one
    // statement the app sends outside any transaction to do it.
    it("is moved by photographs that cannot be fetched", async () => {
      const { letter, bystander } = await twoOldLetters();
      // Where its page row says the photograph is. Nothing put one there.
      const key = uploadObjectKey({
        userId: margaret.id,
        documentId: letter,
        pageNumber: 1,
        contentType: "image/png",
      });

      await readStoredDocument(letter, margaret.id, [
        { pageNumber: 1, mimeType: "image/png", byteSize: 32, key },
      ]);

      expect(await statusOf(letter)).toBe("failed");
      expect(await changedJustNow("documents", letter)).toBe(true);
      expect(await changedJustNow("documents", bystander)).toBe(false);
      expect(logged).toEqual([
        `[uploads] could not fetch the photographs of document ${letter} to read them`,
      ]);
    });

    it("is moved by saving it", async () => {
      const letter = await aLetterToCheck(margaret, BILL);
      const bystander = await aLetterToCheck(margaret, FORM);
      await madeAnHourOld("documents", letter);
      await madeAnHourOld("documents", bystander);

      await confirmDocument(letter, margaret.id, MELBOURNE);

      expect(await statusOf(letter)).toBe("confirmed");
      expect(await changedJustNow("documents", letter)).toBe(true);
      expect(await changedJustNow("documents", bystander)).toBe(false);
      expect(logged).toEqual([]);
    });
  });

  describe("on a task", () => {
    it("is moved by ticking it", async () => {
      const task = (await aConfirmedLetter(margaret, BILL)).task!;
      const bystander = (await aConfirmedLetter(margaret, FORM)).task!;
      await madeAnHourOld("tasks", task);
      await madeAnHourOld("tasks", bystander);

      await completeTask(task, margaret.id, MELBOURNE);

      expect(await stateOf(task)).toBe("completed");
      expect(await changedJustNow("tasks", task)).toBe(true);
      expect(await changedJustNow("tasks", bystander)).toBe(false);
    });

    it("is moved by unticking it", async () => {
      const task = (await aConfirmedLetter(margaret, BILL)).task!;
      const bystander = (await aConfirmedLetter(margaret, FORM)).task!;
      await completeTask(task, margaret.id, MELBOURNE);
      await completeTask(bystander, margaret.id, MELBOURNE);
      await madeAnHourOld("tasks", task);
      await madeAnHourOld("tasks", bystander);

      await reopenTask(task, margaret.id, MELBOURNE);

      expect(await stateOf(task)).toBe("open");
      expect(await changedJustNow("tasks", task)).toBe(true);
      expect(await changedJustNow("tasks", bystander)).toBe(false);
    });
  });

  describe("on a person", () => {
    it("is moved by an UPDATE written with the builder", async () => {
      const dorothy = await aPerson("Dorothy");
      await madeAnHourOld("users", margaret.id);
      await madeAnHourOld("users", dorothy.id);

      await db()
        .update(users)
        .set({ displayName: "Margaret Whitfield" })
        .where(eq(users.id, margaret.id));

      expect(
        await rows("SELECT display_name FROM users WHERE id = $1", [
          margaret.id,
        ]),
      ).toEqual([{ display_name: "Margaret Whitfield" }]);
      expect(await changedJustNow("users", margaret.id)).toBe(true);
      expect(await changedJustNow("users", dorothy.id)).toBe(false);
    });
  });

  // Every test above would pass with updated_at stamped by the app's clock,
  // because here the app and the database run on one machine. Deployed, each
  // copy of the app has a clock of its own.
  describe("whatever the app's clock says", () => {
    it("is stamped by the database's clock, on a letter, a task and a person", async () => {
      const letter = await aLetterToCheck(margaret, BILL);
      const task = (await aConfirmedLetter(margaret, FORM)).task!;
      await madeAnHourOld("documents", letter);
      await madeAnHourOld("tasks", task);
      await madeAnHourOld("users", margaret.id);
      // The day the letter is saved on is handed in, so the reminders are
      // planned from today and only the stamp is left to the clocks.
      const today = new Date();

      await withTheAppClockIn2001(async () => {
        await confirmDocument(letter, margaret.id, MELBOURNE, today);
        await completeTask(task, margaret.id, MELBOURNE, today);
        await db()
          .update(users)
          .set({ displayName: "Margaret Whitfield" })
          .where(eq(users.id, margaret.id));
      });

      expect(await statusOf(letter)).toBe("confirmed");
      expect(await stateOf(task)).toBe("completed");
      expect(await changedJustNow("documents", letter)).toBe(true);
      expect(await changedJustNow("tasks", task)).toBe(true);
      expect(await changedJustNow("users", margaret.id)).toBe(true);
      expect(logged).toEqual([]);
    });
  });
});
