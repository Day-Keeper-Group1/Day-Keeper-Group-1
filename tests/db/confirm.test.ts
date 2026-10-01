// KAN-92: what confirming a letter writes, and what it refuses, against a real PostgreSQL.

/**
 * Confirming a letter.
 *
 * src/server/confirm.ts turns a letter the person has checked into a task with
 * reminders, in one transaction. Here it runs against a real database, on
 * letters the app's own functions made (./support/world.ts), and what it left
 * in the documents, tasks, reminders and audit_logs tables is read through the
 * witness. The statements behind it are in src/server/db/queries/: documents.ts
 * for the lock and the mark, readings.ts for the action, tasks.ts for the task
 * and its reminders, audit.ts for the line in the log.
 *
 * Only the model is a stand-in (./support/fakes.ts).
 *
 * Which reminders are still ahead depends on the day a letter is confirmed, so
 * every test passes the same `now`, and the letters are due around it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { ConfirmRefused, confirmDocument } from "@/server/confirm";
import { db } from "@/server/db";
import {
  lockOwnedDocument,
  markOwnedDocumentConfirmed,
} from "@/server/db/queries/documents";

import { resetFakes } from "./support/fakes";
import { backdate, rows, snapshot } from "./support/witness";
import {
  aConfirmedLetter,
  aFailedLetter,
  aLetterToCheck,
  aPerson,
  aQueuedLetter,
  aReading,
  anArchivedLetter,
  type Person,
} from "./support/world";

const MELBOURNE = "Australia/Melbourne";

/** Midday on Tuesday 15 September 2026 in Melbourne. */
const NOW = new Date("2026-09-15T02:00:00Z");

/** An id of the right shape that nothing has. */
const NOBODYS = "00000000-0000-4000-8000-000000000000";

/** A bill due on Monday 21 September, six days after NOW. */
const WATER_BILL = aReading({
  document_type: "Water bill",
  issuer: "Yarra Valley Water",
  action_required: "Pay Yarra Valley Water",
  due_date: "2026-09-21",
  amount: "$88.10",
  reference: "Not applicable",
});

/** A statement that asks for nothing. */
const STATEMENT = aReading({
  document_type: "Annual statement",
  issuer: "Wattlebank Super",
  action_required: "No action",
  due_date: "Not applicable",
  amount: "No payment required",
  reference: "Not applicable",
});

/** A letter that asks for a phone call and names no day. */
const REFERRAL = aReading({
  document_type: "Government letter",
  issuer: "Services Australia",
  action_required: "Contact Centrelink",
  due_date: "Not applicable",
  amount: "No payment required",
  reference: "Not applicable",
});

/** The same statement, with the reader unsure that it asks for nothing. */
const UNSURE_STATEMENT = aReading({
  document_type: "Annual statement",
  issuer: "Wattlebank Super",
  action_required: { value: "No action", status: "uncertain" },
  due_date: "Not applicable",
  amount: "No payment required",
  reference: "Not applicable",
});

/** An appointment on the 21st, at half past ten. */
const APPOINTMENT = aReading({
  document_type: "Appointment letter",
  issuer: "Northside Eye Clinic",
  action_required: "Attend Northside Eye Clinic",
  due_date: "2026-09-21",
  due_time: "10:30",
  amount: "No payment required",
  reference: "Not applicable",
});

/** A bill due on Wednesday 16 September, the day after NOW. */
const BILL_DUE_TOMORROW = aReading({
  document_type: "Gas bill",
  issuer: "Example Energy",
  action_required: "Pay Example Energy",
  due_date: "2026-09-16",
  amount: "$41.20",
  reference: "Not applicable",
});

/** One letter as the documents table holds it, its two moments as whether they are of just now. */
async function storedLetter(letter: string) {
  const [stored] = await rows<{
    status: string;
    confirmedJustNow: boolean | null;
    updatedJustNow: boolean;
  }>(
    `SELECT status,
            confirmed_at > now() - interval '1 minute' AS "confirmedJustNow",
            updated_at > now() - interval '1 minute' AS "updatedJustNow"
       FROM documents WHERE id = $1`,
    [letter],
  );
  return stored;
}

/** Every task as the tasks table holds it, the day and the time as PostgreSQL prints them. */
function storedTasks() {
  return rows<{
    id: string;
    userId: string;
    documentId: string | null;
    title: string;
    issuer: string | null;
    dueDate: string | null;
    dueTime: string | null;
    state: string;
  }>(
    `SELECT id,
            user_id AS "userId",
            document_id AS "documentId",
            title,
            issuer,
            due_date::text AS "dueDate",
            due_time::text AS "dueTime",
            state
       FROM tasks
      ORDER BY created_at, id`,
  );
}

/** Every reminder as the reminders table holds it, earliest day first. */
function storedReminders() {
  return rows<{ id: string; taskId: string; remindOn: string }>(
    `SELECT id, task_id AS "taskId", remind_on::text AS "remindOn"
       FROM reminders
      ORDER BY remind_on, id`,
  );
}

/** Every line of the audit log, with what kind of JSON its detail is stored as. */
function storedAuditLines() {
  return rows<{
    actorId: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    detail: unknown;
    detailIs: string;
  }>(
    `SELECT actor_id AS "actorId",
            action,
            target_type AS "targetType",
            target_id AS "targetId",
            detail,
            jsonb_typeof(detail) AS "detailIs"
       FROM audit_logs
      ORDER BY created_at, id`,
  );
}

/** A letter of a person's in each status that cannot be confirmed. */
const A_LETTER_THAT_IS = {
  confirmed: async (person: Person) =>
    (await aConfirmedLetter(person, WATER_BILL, { now: NOW })).letter,
  archived: async (person: Person) =>
    (await anArchivedLetter(person, WATER_BILL)).letter,
  processing: (person: Person) => aQueuedLetter(person),
  failed: (person: Person) => aFailedLetter(person),
};

/** What the app says when one call of the reader fails, which is what aFailedLetter() makes happen twice. */
const A_READER_CALL_FAILED =
  /^\[uploads\] reading document [0-9a-f-]{36} failed: reader [12], attempt 1 of 3$/;

describe("confirming a letter", () => {
  let margaret: Person;
  let dorothy: Person;
  /** What reached console.error. */
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
    // Nothing was logged that a failed letter does not explain.
    expect(logged.filter((line) => !A_READER_CALL_FAILED.test(line))).toEqual(
      [],
    );
  });

  it("makes a task named from the action, with the reminders still ahead", async () => {
    // Two other letters wait beside hers: another of her own, and somebody
    // else's. Confirming one letter is about that letter only.
    const statement = await aLetterToCheck(margaret, STATEMENT);
    const dorothys = await aLetterToCheck(dorothy, REFERRAL);
    const letter = await aLetterToCheck(margaret, WATER_BILL);
    await backdate("documents", "updated_at", letter, "1 hour");

    const result = await confirmDocument(letter, margaret.id, MELBOURNE, NOW);

    // The action already names who, so nothing is added in brackets.
    const tasks = await storedTasks();
    expect(tasks).toEqual([
      {
        id: expect.any(String),
        userId: margaret.id,
        documentId: letter,
        title: "Pay Yarra Valley Water",
        issuer: "Yarra Valley Water",
        dueDate: "2026-09-21",
        dueTime: null,
        state: "open",
      },
    ]);
    const task = tasks[0].id;

    // Due the 21st, confirmed the 15th: 7 days before is already gone, so the
    // 18th and the 20th are planned, as days.
    const reminders = await storedReminders();
    expect(reminders).toEqual([
      { id: expect.any(String), taskId: task, remindOn: "2026-09-18" },
      { id: expect.any(String), taskId: task, remindOn: "2026-09-20" },
    ]);

    // The letter is confirmed at the database's now, and says it changed.
    expect(await storedLetter(letter)).toEqual({
      status: "confirmed",
      confirmedJustNow: true,
      updatedJustNow: true,
    });
    expect((await storedLetter(statement)).status).toBe("needs-review");
    expect((await storedLetter(dorothys)).status).toBe("needs-review");

    // One line in the log. Metadata only, never a value from the letter, and
    // stored as a JSON object, not as the text of one.
    expect(await storedAuditLines()).toEqual([
      {
        actorId: margaret.id,
        action: "document.confirm",
        targetType: "document",
        targetId: letter,
        detail: { taskId: task, reminders: 2 },
        detailIs: "object",
      },
    ]);

    // The answer is the new task as a list row shows it.
    expect(result).toEqual({
      documentId: letter,
      task: {
        id: task,
        title: "Pay Yarra Valley Water",
        documentId: letter,
        issuer: "Yarra Valley Water",
        dueDate: "2026-09-21",
        status: "upcoming",
        reminders: [
          { id: reminders[0].id, localDate: "2026-09-18" },
          { id: reminders[1].id, localDate: "2026-09-20" },
        ],
      },
    });
  });

  it("keeps a letter that asks for nothing, and makes no task", async () => {
    const letter = await aLetterToCheck(margaret, STATEMENT);

    const result = await confirmDocument(letter, margaret.id, MELBOURNE, NOW);

    expect(result).toEqual({ documentId: letter, task: null });
    expect(await storedTasks()).toEqual([]);
    expect(await storedReminders()).toEqual([]);
    expect((await storedLetter(letter)).status).toBe("confirmed");
    expect(
      (await storedAuditLines()).map(({ detail, detailIs }) => ({
        detail,
        detailIs,
      })),
    ).toEqual([{ detail: { taskId: null, reminders: 0 }, detailIs: "object" }]);
  });

  it("makes a task with no reminders for a letter that names no date", async () => {
    const letter = await aLetterToCheck(margaret, REFERRAL);

    const result = await confirmDocument(letter, margaret.id, MELBOURNE, NOW);

    // The action does not say who, so the issuer goes in brackets.
    const [task] = await storedTasks();
    expect(task).toMatchObject({
      title: "Contact Centrelink (Services Australia)",
      issuer: "Services Australia",
      dueDate: null,
      dueTime: null,
    });
    expect(await storedReminders()).toEqual([]);
    expect((await storedLetter(letter)).status).toBe("confirmed");
    expect((await storedAuditLines()).map((line) => line.detail)).toEqual([
      { taskId: task.id, reminders: 0 },
    ]);
    expect(result?.task).toMatchObject({
      id: task.id,
      dueDate: null,
      reminders: [],
    });
  });

  it("locks the letter it reads, so two taps cannot make two tasks", async () => {
    const letter = await aLetterToCheck(margaret, WATER_BILL);

    // Two taps at once, each in a transaction and on a connection of its own.
    // Without the lock both would find the letter waiting and both would make
    // a task. With it the second waits for the first to finish, finds the
    // letter confirmed, and is refused.
    const taps = await Promise.allSettled([
      confirmDocument(letter, margaret.id, MELBOURNE, NOW),
      confirmDocument(letter, margaret.id, MELBOURNE, NOW),
    ]);

    const saved = taps.filter((tap) => tap.status === "fulfilled");
    const refused = taps.filter((tap) => tap.status === "rejected");
    expect(saved).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].reason).toBeInstanceOf(ConfirmRefused);
    expect((refused[0].reason as Error).message).toBe(
      "This letter is already saved.",
    );

    const tasks = await storedTasks();
    expect(tasks).toHaveLength(1);
    expect(saved[0].value).toMatchObject({
      documentId: letter,
      task: { id: tasks[0].id },
    });
    expect(
      (await storedReminders()).map((reminder) => reminder.remindOn),
    ).toEqual(["2026-09-18", "2026-09-20"]);
    expect(await storedAuditLines()).toHaveLength(1);
  });

  it("answers null for a letter that is not hers, and for an id that is not one", async () => {
    const letter = await aLetterToCheck(margaret, WATER_BILL);
    const before = await snapshot();

    expect(
      await confirmDocument(letter, dorothy.id, MELBOURNE, NOW),
    ).toBeNull();
    expect(
      await confirmDocument(NOBODYS, margaret.id, MELBOURNE, NOW),
    ).toBeNull();
    // Not the shape of an id, so PostgreSQL is never asked and has nothing to
    // refuse.
    expect(
      await confirmDocument("not-a-uuid", margaret.id, MELBOURNE, NOW),
    ).toBeNull();

    // confirmDocument() asks for the letter under its owner twice: when it
    // locks it and when it marks it. A stranger is stopped at the lock, so her
    // null says nothing about the mark. Each is asked by itself.
    expect(await lockOwnedDocument(db(), dorothy.id, letter)).toBeNull();
    await markOwnedDocumentConfirmed(db(), dorothy.id, letter);

    expect(await snapshot()).toEqual(before);

    // And both find the letter for the person it belongs to.
    expect(await lockOwnedDocument(db(), margaret.id, letter)).toEqual({
      status: "needs-review",
      issuer: "Yarra Valley Water",
      documentType: "Water bill",
      dueDate: "2026-09-21",
      dueTime: null,
    });
    await markOwnedDocumentConfirmed(db(), margaret.id, letter);
    expect((await storedLetter(letter)).status).toBe("confirmed");
  });

  it.each([
    ["confirmed", "This letter is already saved."],
    ["archived", "This letter is already saved."],
    ["processing", "This letter is still being read."],
    ["failed", "This letter could not be read, so there is nothing to save."],
  ] as const)(
    "refuses a letter that is %s, and writes nothing",
    async (status, message) => {
      const letter = await A_LETTER_THAT_IS[status](margaret);
      expect((await storedLetter(letter)).status).toBe(status);
      const before = await snapshot();

      const refusal = await confirmDocument(
        letter,
        margaret.id,
        MELBOURNE,
        NOW,
      ).catch((error: unknown) => error);

      expect(refusal).toBeInstanceOf(ConfirmRefused);
      expect((refusal as Error).message).toBe(message);
      expect(await snapshot()).toEqual(before);
    },
  );

  it("does not use an action the reader was unsure of", async () => {
    const letter = await aLetterToCheck(margaret, UNSURE_STATEMENT);

    const result = await confirmDocument(letter, margaret.id, MELBOURNE, NOW);

    // The card never showed the hedged "No action", so it neither stops a task
    // from being made nor names it: the task is called after who wrote.
    const [task] = await storedTasks();
    expect(task.title).toBe("Letter from Wattlebank Super");
    expect(result?.task?.id).toBe(task.id);
    expect((await storedLetter(letter)).status).toBe("confirmed");
  });

  it("copies the time of an appointment onto its task", async () => {
    const letter = await aLetterToCheck(margaret, APPOINTMENT);

    const result = await confirmDocument(letter, margaret.id, MELBOURNE, NOW);

    // Stored as a time, and answered the way the browser receives it: 'HH:MM'.
    const [task] = await storedTasks();
    expect(task).toMatchObject({ dueDate: "2026-09-21", dueTime: "10:30:00" });
    expect(result?.task).toMatchObject({
      id: task.id,
      dueDate: "2026-09-21",
      dueTime: "10:30",
    });
  });

  it("makes a task with no reminders for a letter due tomorrow", async () => {
    const letter = await aLetterToCheck(margaret, BILL_DUE_TOMORROW);

    const result = await confirmDocument(letter, margaret.id, MELBOURNE, NOW);

    // 7, 3 and 1 days before the 16th are the 9th, the 13th and the 15th, and
    // none of them is still ahead on the 15th. The date is there and the list
    // of days is empty, which must not stop the rest from being written.
    const [task] = await storedTasks();
    expect(task).toMatchObject({
      title: "Pay Example Energy",
      dueDate: "2026-09-16",
    });
    expect(await storedReminders()).toEqual([]);
    expect((await storedLetter(letter)).status).toBe("confirmed");
    expect((await storedAuditLines()).map((line) => line.detail)).toEqual([
      { taskId: task.id, reminders: 0 },
    ]);
    expect(result?.task).toMatchObject({
      id: task.id,
      dueDate: "2026-09-16",
      status: "upcoming",
      reminders: [],
    });
  });
});
