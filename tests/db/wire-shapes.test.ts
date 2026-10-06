// KAN-92: the shape a time, a day, an instant and a JSON value have on the way out of the database and on the way in.

/**
 * Wire shapes.
 *
 * Four kinds of value do not look the same in PostgreSQL and in what the
 * browser receives, and each has a way of going wrong that no type catches.
 *
 *   - A time of day. PostgreSQL prints `10:30:00`; the browser receives
 *     `10:30`. The column type cuts it (timeOfDay in
 *     src/server/db/schema/columns.ts), wherever the column is read, and a
 *     column declared as a bare `time` would send the seconds.
 *   - A day. 'YYYY-MM-DD' in the table and on the wire. Left to the driver, a
 *     `date` becomes a JavaScript Date at midnight on the machine's own clock,
 *     and read back as text on a machine east of Greenwich that is the day
 *     before. The schema declares every `date` column in string mode, which
 *     stops it.
 *   - An instant. A Date from the driver, ISO text on the wire.
 *   - A JSON value. Handed to a jsonb column as an object it is stored as an
 *     object; handed over as its JSON text it is stored as a jsonb string, and
 *     reads back looking right through the same code that wrote it wrong.
 *
 * This file runs with the machine's zone set to Pacific/Kiritimati, fourteen
 * hours ahead of UTC and as far east as a clock goes. CI runs in UTC, where a
 * day shifted to the midnight before it is still the same day and the mistake
 * would pass; here it cannot.
 *
 * What is stored is read through the witness, as text PostgreSQL printed. The
 * bucket is not needed and the model is a stand-in (./support/fakes.ts).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The machine's zone, set before anything is imported, and what it was before.
 * Node reads the variable again whenever it changes.
 */
const zoneBefore = vi.hoisted(() => {
  const before = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati";
  return before;
});

vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { spendSchoolKey } from "@/server/ai/school-key";
import { registerAccount } from "@/server/auth/accounts";
import { hashPassword } from "@/server/auth/password";
import { confirmDocument } from "@/server/confirm";
import { getDocument, getHome, listDocuments } from "@/server/documents";
import { completeTask, getTask, listTasks, reopenTask } from "@/server/tasks";

import { resetFakes } from "./support/fakes";
import { rows } from "./support/witness";
import {
  PASSWORD,
  aLetterToCheck,
  aPerson,
  aReading,
  type Person,
} from "./support/world";

const MELBOURNE = "Australia/Melbourne";

/** A wall clock time as the browser receives one. */
const HH_MM = /^\d\d:\d\d$/;

/** An instant as JSON carries one. */
const AN_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * An appointment on a day and at a time, with one field the contract has
 * never heard of, which is kept in the letter's open payload.
 */
const APPOINTMENT = aReading({
  document_type: "Appointment letter",
  issuer: "Northside Eye Clinic",
  action_required: "Attend Northside Eye Clinic",
  due_date: "2099-03-15",
  due_time: "10:30",
  amount: "No payment required",
  reference: "Not applicable",
  clinic_room: "Level 2, room 14",
});

/** The day and the time of one letter and of the task it became, as PostgreSQL prints them. */
async function storedDayAndTime(letter: string) {
  const [stored] = await rows<{
    letterDay: string;
    letterTime: string;
    taskDay: string;
    taskTime: string;
  }>(
    `SELECT d.due_date::text AS "letterDay",
            d.due_time::text AS "letterTime",
            t.due_date::text AS "taskDay",
            t.due_time::text AS "taskTime"
       FROM documents d JOIN tasks t ON t.document_id = d.id
      WHERE d.id = $1`,
    [letter],
  );
  return stored;
}

describe("wire shapes", () => {
  let margaret: Person;
  let letter: string;

  afterAll(() => {
    // The variable belongs to the process, and the process may go on to run
    // another file.
    if (zoneBefore === undefined) delete process.env.TZ;
    else process.env.TZ = zoneBefore;
  });

  beforeEach(async () => {
    resetFakes();
    margaret = await aPerson("Margaret");
    letter = await aLetterToCheck(margaret, APPOINTMENT);
  });

  it("runs on a machine whose midnight is the day before in UTC", () => {
    // What a `date` handled as an instant would come to here: built at local
    // midnight, and a day short once it is printed.
    expect(new Date(2099, 2, 15).toISOString()).toBe(
      "2099-03-14T10:00:00.000Z",
    );
  });

  it("sends a time of day as HH:MM from every statement that reads one", async () => {
    // Before the letter is saved: the list, the letter itself, and home.
    const [listed] = await listDocuments(margaret.id, MELBOURNE);
    const detail = await getDocument(letter, margaret.id, MELBOURNE);
    const waiting = await getHome(margaret.id, MELBOURNE);

    // Saving it copies the time onto the task, and answers with the task.
    const saved = await confirmDocument(letter, margaret.id, MELBOURNE);
    const task = saved!.task!.id;

    const [listedTask] = await listTasks(margaret.id, MELBOURNE);
    const taskDetail = await getTask(task, margaret.id, MELBOURNE);
    const home = await getHome(margaret.id, MELBOURNE);
    // Ticking and unticking answer from an UPDATE read back through a CTE.
    const ticked = await completeTask(task, margaret.id, MELBOURNE);
    const unticked = await reopenTask(task, margaret.id, MELBOURNE);

    const times = {
      "the letter list": listed.dueTime,
      "one letter": detail?.dueTime,
      "home, the inbox": waiting.inbox[0].dueTime,
      "the task saving answers with": saved?.task?.dueTime,
      "the task list": listedTask.dueTime,
      "one task": taskDetail?.dueTime,
      "home, the tasks": home.tasks[0].dueTime,
      "the ticked task": ticked?.dueTime,
      "the unticked task": unticked?.dueTime,
    };
    for (const [where, time] of Object.entries(times)) {
      expect(time, where).toMatch(HH_MM);
      expect(time, where).toBe("10:30");
    }

    // In both tables it is a time, seconds and all.
    expect(await storedDayAndTime(letter)).toMatchObject({
      letterTime: "10:30:00",
      taskTime: "10:30:00",
    });
  });

  it("reads and writes a day as the day it is", async () => {
    const [listed] = await listDocuments(margaret.id, MELBOURNE);
    const detail = await getDocument(letter, margaret.id, MELBOURNE);
    const waiting = await getHome(margaret.id, MELBOURNE);

    const saved = await confirmDocument(letter, margaret.id, MELBOURNE);
    const task = saved!.task!.id;

    const [listedTask] = await listTasks(margaret.id, MELBOURNE);
    const taskDetail = await getTask(task, margaret.id, MELBOURNE);
    const home = await getHome(margaret.id, MELBOURNE);
    const ticked = await completeTask(task, margaret.id, MELBOURNE);
    const unticked = await reopenTask(task, margaret.id, MELBOURNE);

    const days = {
      "the letter list": listed.dueDate,
      "one letter": detail?.dueDate,
      "home, the inbox": waiting.inbox[0].dueDate,
      "the task saving answers with": saved?.task?.dueDate,
      "the task list": listedTask.dueDate,
      "one task": taskDetail?.dueDate,
      "home, the tasks": home.tasks[0].dueDate,
      "the ticked task": ticked?.dueDate,
      "the unticked task": unticked?.dueDate,
    };
    for (const [where, day] of Object.entries(days)) {
      expect(day, where).toBe("2099-03-15");
    }

    // The days a task is marked on are days too: 7, 3 and 1 before the 15th.
    const remindOn = ["2099-03-08", "2099-03-12", "2099-03-14"];
    const reminders = {
      "the task saving answers with": saved?.task?.reminders,
      "the task list": listedTask.reminders,
      "one task": taskDetail?.reminders,
      "home, the tasks": home.tasks[0].reminders,
      "the ticked task": ticked?.reminders,
      "the unticked task": unticked?.reminders,
    };
    for (const [where, list] of Object.entries(reminders)) {
      expect(
        list?.map((reminder) => reminder.localDate),
        where,
      ).toEqual(remindOn);
    }

    // And the same days are what was written: on the letter by the reading,
    // on the task by saving it, and in the reminders.
    expect(await storedDayAndTime(letter)).toMatchObject({
      letterDay: "2099-03-15",
      taskDay: "2099-03-15",
    });
    expect(
      await rows(
        `SELECT remind_on::text AS "remindOn" FROM reminders
          WHERE task_id = $1 ORDER BY remind_on`,
        [task],
      ),
    ).toEqual(remindOn.map((day) => ({ remindOn: day })));
  });

  it("sends the moment a letter was photographed as an ISO string", async () => {
    const [stored] = await rows<{ uploadedAt: string }>(
      `SELECT to_char(uploaded_at AT TIME ZONE 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "uploadedAt"
         FROM documents WHERE id = $1`,
      [letter],
    );

    const [listed] = await listDocuments(margaret.id, MELBOURNE);
    const detail = await getDocument(letter, margaret.id, MELBOURNE);
    const home = await getHome(margaret.id, MELBOURNE);

    const moments = {
      "the letter list": listed.uploadedAt,
      "one letter": detail?.uploadedAt,
      "home, the inbox": home.inbox[0].uploadedAt,
    };
    for (const [where, moment] of Object.entries(moments)) {
      expect(typeof moment, where).toBe("string");
      expect(moment, where).toMatch(AN_INSTANT);
      // The very instant the row holds, in UTC whatever the machine's zone.
      expect(moment, where).toBe(stored.uploadedAt);
    }
  });

  it("stores a JSON value as an object, never as its text", async () => {
    // Every line the audit log is given: saving a letter, with a detail;
    // registering, with none, so the column's default applies; and a use of
    // the school key, with a detail.
    await confirmDocument(letter, margaret.id, MELBOURNE);
    await registerAccount({
      email: "dorothy@example.com",
      displayName: "Dorothy",
      passwordHash: await hashPassword(PASSWORD),
    });
    await spendSchoolKey("letters", { type: "document", id: letter });

    // What else the reader returned, kept on the letter.
    expect(
      await rows(
        `SELECT jsonb_typeof(open_payload) AS kind, open_payload AS payload
           FROM documents WHERE id = $1`,
        [letter],
      ),
    ).toEqual([
      {
        kind: "object",
        payload: {
          clinic_room: {
            key: "clinic_room",
            value: "Level 2, room 14",
            status: "confirmed",
          },
        },
      },
    ]);

    // The reading itself, kept on the round that decided it.
    expect(
      await rows(
        `SELECT jsonb_typeof(raw_response) AS kind
           FROM extraction_runs WHERE document_id = $1`,
        [letter],
      ),
    ).toEqual([{ kind: "object" }]);

    expect(
      await rows(
        `SELECT action, jsonb_typeof(detail) AS kind
           FROM audit_logs ORDER BY action`,
      ),
    ).toEqual([
      { action: "ai.call", kind: "object" },
      { action: "document.confirm", kind: "object" },
      { action: "user.register", kind: "object" },
    ]);
  });
});
