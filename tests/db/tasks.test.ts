// KAN-92: listing, opening, ticking and unticking tasks, against a real PostgreSQL.

/**
 * Tasks.
 *
 * src/server/tasks.ts answers the task endpoints. Here its functions run
 * against a real database, on tasks made the way the app makes them, by
 * confirming a letter (./support/world.ts), and what they left in the tasks
 * and reminders tables is read through the witness. The statements behind
 * them are in src/server/db/queries/tasks.ts, and for the letter a task came
 * from, documents.ts and readings.ts beside it.
 *
 * Only the model is a stand-in (./support/fakes.ts). A task from no letter and
 * a dismissed task are things no code writes, so these tests write them
 * directly.
 *
 * The letters are due in 2099, so no reminder is ever in the past and no task
 * is overdue unless a test passes a `now` that makes it so.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { db } from "@/server/db";
import { dbCause } from "@/server/db/errors";
import { findOwnedPageCount } from "@/server/db/queries/documents";
import {
  listOwnedFieldRowsInTaskOrder,
  listOwnedIdentifierRows,
} from "@/server/db/queries/readings";
import {
  completeTask,
  getTask,
  getTaskSummary,
  listTasks,
  reopenTask,
} from "@/server/tasks";

import { resetFakes } from "./support/fakes";
import { backdate, rows, snapshot } from "./support/witness";
import {
  aConfirmedLetter,
  aPerson,
  aReading,
  aTaskNoCodeWrites,
  type Person,
} from "./support/world";

const MELBOURNE = "Australia/Melbourne";

/** An id of the right shape that nothing has. */
const NOBODYS = "00000000-0000-4000-8000-000000000000";

/**
 * A bill: something to pay, by a day and a time, with numbers printed on it.
 * The reader answers the fields in no order a screen shows them in, with two
 * the contract has never heard of, and it hedges the reference.
 */
const BILL = aReading(
  {
    reference: { value: "4417 2290 113", status: "uncertain" },
    due_time: "10:30",
    supply_period: "1 Dec 2098 to 28 Feb 2099",
    amount: "$347.60",
    document_type: "Utility bill",
    action_required: "Pay Example Energy",
    issuer: "Example Energy",
    due_date: "2099-03-15",
    bpay_biller_code: "23796",
  },
  [
    { label: "Meter number", value: "MTR 88 201", status: "uncertain" },
    { label: "Invoice number", value: "INV-2099-0215" },
    { label: "Customer number", value: "CN 5512 08" },
  ],
);

/** A form to send back, by a day earlier than the bill's. */
const FORM = aReading({
  document_type: "Concession form",
  issuer: "Harbour Water",
  action_required: "Return form to Harbour Water",
  due_date: "2099-02-03",
  amount: "No payment required",
  reference: "Not applicable",
});

/** A letter that asks for a phone call and names no day. */
const REFERRAL = aReading({
  document_type: "Government letter",
  issuer: "My Aged Care",
  action_required: "Contact a Support at Home provider",
  due_date: "Not applicable",
  amount: "No payment required",
  reference: "Not applicable",
});

/** Another bill due on the same day as the first. */
const WATER_BILL = aReading({
  document_type: "Water bill",
  issuer: "Harbour Water",
  action_required: "Pay Harbour Water",
  due_date: "2099-03-15",
  amount: "$88.10",
  reference: "Not applicable",
});

/** One task as the tasks table holds it, its two moments as text. */
async function storedTask(taskId: string) {
  const [task] = await rows<{
    state: string;
    completedAt: string | null;
    tickedJustNow: boolean | null;
  }>(
    `SELECT state,
            completed_at::text AS "completedAt",
            completed_at > now() - interval '1 minute' AS "tickedJustNow"
       FROM tasks WHERE id = $1`,
    [taskId],
  );
  return task;
}

/** Every reminder row, as PostgreSQL prints it, in a fixed order. */
function storedReminders() {
  return rows("SELECT to_jsonb(r) AS stored FROM reminders r ORDER BY r.id");
}

/** The reminders of one task as the browser receives them, earliest day first. */
function remindersOf(taskId: string) {
  return rows<{ id: string; localDate: string }>(
    `SELECT id, remind_on::text AS "localDate"
       FROM reminders WHERE task_id = $1
      ORDER BY remind_on, id`,
    [taskId],
  );
}

describe("tasks", () => {
  let margaret: Person;
  let dorothy: Person;
  /** What reached console.error. Nothing here should. */
  let logged: string[];

  beforeEach(async () => {
    resetFakes();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
    margaret = await aPerson("Margaret");
    dorothy = await aPerson("Dorothy");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    expect(logged).toEqual([]);
  });

  describe("task list", () => {
    it("is scoped to its owner and leaves out dismissed tasks", async () => {
      await aTaskNoCodeWrites(margaret, { title: "Ring the plumber" });
      await aTaskNoCodeWrites(margaret, { title: "Renew the library card" });
      await aTaskNoCodeWrites(margaret, {
        title: "Dismissed long ago",
        state: "dismissed",
      });
      await aTaskNoCodeWrites(dorothy, { title: "Book the car in" });

      const hers = await listTasks(margaret.id, MELBOURNE);
      expect(hers.map((task) => task.title).sort()).toEqual([
        "Renew the library card",
        "Ring the plumber",
      ]);
      expect(
        (await listTasks(dorothy.id, MELBOURNE)).map((task) => task.title),
      ).toEqual(["Book the car in"]);

      // Nothing is cut: a cap would drop the furthest tasks without a word.
      const agnes = await aPerson("Agnes");
      await rows(
        `INSERT INTO tasks (user_id, title)
         SELECT $1, 'Task ' || n FROM generate_series(1, 60) AS n`,
        [agnes.id],
      );
      expect(await listTasks(agnes.id, MELBOURNE)).toHaveLength(60);
    });

    it("returns ordered task summaries with every reminder", async () => {
      // Made in another order than the one they are shown in: the later date
      // first, the one with no date in the middle.
      const bill = await aConfirmedLetter(margaret, BILL);
      const referral = await aConfirmedLetter(margaret, REFERRAL);
      const form = await aConfirmedLetter(margaret, FORM);
      const water = await aConfirmedLetter(margaret, WATER_BILL);
      const loose = await aTaskNoCodeWrites(margaret, {
        title: "Call the issuer",
      });
      // Two tasks are due on 15 March, and they stay in the order they were
      // made. The one with the later id is made the older of the two here, so
      // their ids, which settle the order next, would put them the other way.
      const [newer, older] = [bill, water].sort((a, b) =>
        a.task! < b.task! ? -1 : 1,
      );
      await backdate("tasks", "created_at", older.task!, "1 hour");
      // A reminder written after the others, for an earlier day.
      await rows(
        "INSERT INTO reminders (task_id, remind_on) VALUES ($1, '2099-03-01')",
        [bill.task],
      );

      const result = await listTasks(margaret.id, MELBOURNE);

      const summaryOf = {
        [bill.task!]: {
          id: bill.task,
          title: "Pay Example Energy",
          documentId: bill.letter,
          issuer: "Example Energy",
          dueDate: "2099-03-15",
          dueTime: "10:30",
          status: "upcoming",
          reminders: await remindersOf(bill.task!),
        },
        [water.task!]: {
          id: water.task,
          title: "Pay Harbour Water",
          documentId: water.letter,
          issuer: "Harbour Water",
          dueDate: "2099-03-15",
          status: "upcoming",
          reminders: await remindersOf(water.task!),
        },
      };

      // Soonest due first, the two with no date last, and each task's
      // reminders from the earliest day to the latest.
      expect(result).toEqual([
        {
          id: form.task,
          title: "Return form to Harbour Water",
          documentId: form.letter,
          issuer: "Harbour Water",
          dueDate: "2099-02-03",
          status: "upcoming",
          reminders: await remindersOf(form.task!),
        },
        summaryOf[older.task!],
        summaryOf[newer.task!],
        {
          id: referral.task,
          title: "Contact a Support at Home provider (My Aged Care)",
          documentId: referral.letter,
          issuer: "My Aged Care",
          dueDate: null,
          status: "upcoming",
          reminders: [],
        },
        {
          id: loose,
          title: "Call the issuer",
          issuer: null,
          dueDate: null,
          status: "upcoming",
          reminders: [],
        },
      ]);
      const listedBill = result.find((task) => task.id === bill.task)!;
      expect(
        listedBill.reminders.map((reminder) => reminder.localDate),
      ).toEqual(["2099-03-01", "2099-03-08", "2099-03-12", "2099-03-14"]);

      // The keys in the order a route sends them, the optional ones left out
      // rather than sent as null.
      expect(Object.keys(listedBill)).toEqual([
        "id",
        "title",
        "documentId",
        "issuer",
        "dueDate",
        "dueTime",
        "status",
        "reminders",
      ]);
      expect(Object.keys(result[4])).toEqual([
        "id",
        "title",
        "issuer",
        "dueDate",
        "status",
        "reminders",
      ]);
    });

    it("uses the person's timezone when deciding whether a task is overdue", async () => {
      await aTaskNoCodeWrites(margaret, {
        title: "Pay bill",
        dueDate: "2026-08-14",
      });
      // Half past midnight on the 15th in Melbourne, still the morning of the
      // 14th in Los Angeles.
      const now = new Date("2026-08-14T14:30:00.000Z");

      const melbourne = await listTasks(margaret.id, MELBOURNE, now);
      const losAngeles = await listTasks(
        margaret.id,
        "America/Los_Angeles",
        now,
      );

      expect(melbourne[0].status).toBe("overdue");
      expect(losAngeles[0].status).toBe("upcoming");
    });
  });

  describe("complete task", () => {
    it("updates only the owned task and does not write reminders", async () => {
      const bill = await aConfirmedLetter(margaret, BILL);
      const form = await aConfirmedLetter(margaret, FORM);
      const reminders = await storedReminders();
      const ticked = {
        id: bill.task,
        title: "Pay Example Energy",
        documentId: bill.letter,
        issuer: "Example Energy",
        dueDate: "2099-03-15",
        dueTime: "10:30",
        status: "completed",
        reminders: await remindersOf(bill.task!),
      };
      expect(ticked.reminders).toHaveLength(3);

      expect(await completeTask(bill.task!, margaret.id, MELBOURNE)).toEqual(
        ticked,
      );

      expect(await storedTask(bill.task!)).toMatchObject({
        state: "completed",
        tickedJustNow: true,
      });
      expect(await storedTask(form.task!)).toMatchObject({
        state: "open",
        completedAt: null,
      });
      // Ticking takes nothing away: the reminder days are still there.
      expect(await storedReminders()).toEqual(reminders);

      // A second tick answers the same and keeps the moment of the first.
      await backdate("tasks", "completed_at", bill.task!, "2 hours");
      const first = (await storedTask(bill.task!)).completedAt;
      expect(await completeTask(bill.task!, margaret.id, MELBOURNE)).toEqual(
        ticked,
      );
      expect(await storedTask(bill.task!)).toEqual({
        state: "completed",
        completedAt: first,
        tickedJustNow: false,
      });
    });

    it("returns null when the task is missing or belongs to another user", async () => {
      const bill = await aConfirmedLetter(margaret, BILL);
      const dismissed = await aTaskNoCodeWrites(margaret, {
        state: "dismissed",
      });
      const before = await snapshot();

      expect(await completeTask(NOBODYS, margaret.id, MELBOURNE)).toBeNull();
      expect(await completeTask(bill.task!, dorothy.id, MELBOURNE)).toBeNull();
      // A dismissed task is hers and is not there to be ticked.
      expect(await completeTask(dismissed, margaret.id, MELBOURNE)).toBeNull();

      // And nothing was written: her task is still open, the dismissed one
      // still dismissed.
      expect(await snapshot()).toEqual(before);
    });
  });

  describe("one task", () => {
    it("returns the owned task with its fields and page count", async () => {
      const bill = await aConfirmedLetter(margaret, BILL, { pages: 2 });

      const result = await getTask(bill.task!, margaret.id, MELBOURNE);

      expect(result).toEqual({
        id: bill.task,
        title: "Pay Example Energy",
        documentId: bill.letter,
        issuer: "Example Energy",
        dueDate: "2099-03-15",
        dueTime: "10:30",
        status: "upcoming",
        reminders: await remindersOf(bill.task!),
        // The order the task screen shows them in, then the two it has never
        // heard of, in the order of their keys.
        fields: [
          {
            key: "document_type",
            label: "Document type",
            value: "Utility bill",
            status: "confirmed",
          },
          {
            key: "issuer",
            label: "From",
            value: "Example Energy",
            status: "confirmed",
          },
          {
            key: "action_required",
            label: "What to do",
            value: "Pay Example Energy",
            status: "confirmed",
          },
          {
            key: "due_date",
            label: "Due date",
            value: "15 Mar 2099",
            status: "confirmed",
          },
          {
            key: "due_time",
            label: "Time",
            value: "10:30",
            status: "confirmed",
          },
          {
            key: "amount",
            label: "Amount",
            value: "$347.60",
            status: "confirmed",
          },
          // The reader hedged it, so it is shown as not read and its value
          // stays on the server.
          {
            key: "reference",
            label: "Reference",
            value: null,
            status: "unreadable",
          },
          {
            key: "bpay_biller_code",
            label: "Bpay biller code",
            value: "23796",
            status: "confirmed",
          },
          {
            key: "supply_period",
            label: "Supply period",
            value: "1 Dec 2098 to 28 Feb 2099",
            status: "confirmed",
          },
        ],
        // The number the reader hedged is dropped.
        identifiers: [
          {
            label: "Invoice number",
            value: "INV-2099-0215",
            isReference: false,
          },
          {
            label: "Customer number",
            value: "CN 5512 08",
            isReference: false,
          },
        ],
        pageCount: 2,
      });
      expect(Object.keys(result!)).toEqual([
        "id",
        "title",
        "documentId",
        "issuer",
        "dueDate",
        "dueTime",
        "status",
        "reminders",
        "fields",
        "identifiers",
        "pageCount",
      ]);

      // A task shows the fields that are stored and fills none in: with one
      // taken out of storage, it is missing here, where the letter screen
      // would say it could not be read.
      await rows("DELETE FROM extracted_fields WHERE field_key = 'amount'");
      expect(
        (await getTask(bill.task!, margaret.id, MELBOURNE))?.fields.map(
          (field) => field.key,
        ),
      ).toEqual([
        "document_type",
        "issuer",
        "action_required",
        "due_date",
        "due_time",
        "reference",
        "bpay_biller_code",
        "supply_period",
      ]);
    });

    it("returns null when the task is unavailable", async () => {
      const bill = await aConfirmedLetter(margaret, BILL, { pages: 2 });

      expect(await getTask(NOBODYS, margaret.id, MELBOURNE)).toBeNull();
      expect(await getTask(bill.task!, dorothy.id, MELBOURNE)).toBeNull();

      // getTask() asks four things, and each of them is the ownership check on
      // its own. A stranger's null from getTask() would still be null with one
      // of the four having lost its owner, because another would catch it. So
      // each is asked by itself: found by the owner, absent for anybody else.
      expect(
        (await getTaskSummary(bill.task!, margaret.id, MELBOURNE))?.id,
      ).toBe(bill.task);
      expect(
        await getTaskSummary(bill.task!, dorothy.id, MELBOURNE),
      ).toBeNull();
      expect(await findOwnedPageCount(db(), margaret.id, bill.letter)).toBe(2);
      expect(
        await listOwnedFieldRowsInTaskOrder(db(), margaret.id, bill.letter),
      ).toHaveLength(9);
      expect(
        await listOwnedIdentifierRows(db(), margaret.id, bill.letter),
      ).toHaveLength(3);
      expect(
        await findOwnedPageCount(db(), dorothy.id, bill.letter),
      ).toBeNull();
      expect(
        await listOwnedFieldRowsInTaskOrder(db(), dorothy.id, bill.letter),
      ).toEqual([]);
      expect(
        await listOwnedIdentifierRows(db(), dorothy.id, bill.letter),
      ).toEqual([]);

      // A dismissed task is not there to be opened, though it is hers and its
      // letter is.
      const dismissed = await aTaskNoCodeWrites(margaret, {
        state: "dismissed",
        documentId: bill.letter,
      });
      expect(await getTask(dismissed, margaret.id, MELBOURNE)).toBeNull();
      expect(
        await getTaskSummary(dismissed, margaret.id, MELBOURNE),
      ).toBeNull();

      // A task whose letter is gone cannot be opened, and is still on the
      // list, with no letter to point at.
      await rows("DELETE FROM documents WHERE id = $1", [bill.letter]);
      expect(await getTask(bill.task!, margaret.id, MELBOURNE)).toBeNull();
      expect(
        await getTaskSummary(bill.task!, margaret.id, MELBOURNE),
      ).toBeNull();
      const [listed] = await listTasks(margaret.id, MELBOURNE);
      expect(listed.id).toBe(bill.task);
      expect("documentId" in listed).toBe(false);
    });

    // 500 at the endpoint, where a letter answers 404: nothing checks the
    // shape of a task id before PostgreSQL does. Pinned as it is, not as it
    // should be (tests/db/http-characterisation.test.ts records the 500).
    it("lets PostgreSQL refuse an id these tables could not hold", async () => {
      const refusedByPostgres = (error: unknown) =>
        (dbCause(error) as { code?: string }).code === "22P02";

      await expect(
        getTask("not-a-uuid", margaret.id, MELBOURNE),
      ).rejects.toSatisfy(refusedByPostgres);
      await expect(
        completeTask("not-a-uuid", margaret.id, MELBOURNE),
      ).rejects.toSatisfy(refusedByPostgres);
      await expect(
        reopenTask("not-a-uuid", margaret.id, MELBOURNE),
      ).rejects.toSatisfy(refusedByPostgres);
    });
  });

  describe("reopen task", () => {
    it("reopens only the owned task and leaves reminders unchanged", async () => {
      const bill = await aConfirmedLetter(margaret, BILL);
      const form = await aConfirmedLetter(margaret, FORM);
      await completeTask(bill.task!, margaret.id, MELBOURNE);
      await completeTask(form.task!, margaret.id, MELBOURNE);
      const reminders = await storedReminders();

      const result = await reopenTask(bill.task!, margaret.id, MELBOURNE);

      expect(result).toEqual({
        id: bill.task,
        title: "Pay Example Energy",
        documentId: bill.letter,
        issuer: "Example Energy",
        dueDate: "2099-03-15",
        dueTime: "10:30",
        status: "upcoming",
        reminders: await remindersOf(bill.task!),
      });
      expect(result?.reminders).toHaveLength(3);

      expect(await storedTask(bill.task!)).toEqual({
        state: "open",
        completedAt: null,
        tickedJustNow: null,
      });
      expect((await storedTask(form.task!)).state).toBe("completed");
      // Unticking takes nothing back: the reminder days were never removed.
      expect(await storedReminders()).toEqual(reminders);

      // Unticking a task that is not ticked answers the same and changes
      // nothing.
      expect(await reopenTask(bill.task!, margaret.id, MELBOURNE)).toEqual(
        result,
      );
    });

    it("returns null when the task is unavailable", async () => {
      const bill = await aConfirmedLetter(margaret, BILL);
      await completeTask(bill.task!, margaret.id, MELBOURNE);
      const dismissed = await aTaskNoCodeWrites(margaret, {
        state: "dismissed",
      });
      const before = await snapshot();

      expect(await reopenTask(NOBODYS, margaret.id, MELBOURNE)).toBeNull();
      expect(await reopenTask(bill.task!, dorothy.id, MELBOURNE)).toBeNull();
      expect(await reopenTask(dismissed, margaret.id, MELBOURNE)).toBeNull();

      // Her task is still ticked, the dismissed one still dismissed.
      expect(await snapshot()).toEqual(before);
    });
  });
});
