// KAN-92: every statement about tasks and their reminders.

/**
 * Tasks and reminders: the statements.
 *
 * The tables are declared in ../schema/tasks.ts, and this file, named like it,
 * holds every statement the app runs against them. The rules stay with the
 * callers: src/server/tasks.ts decides whether an open task is upcoming or
 * overdue, and src/server/documents.ts decides which ticks the home screen
 * still shows.
 *
 * Every function takes the handle first: `db()` from a service, or the `tx` of
 * a transaction the service opened. Nothing here opens a transaction, and
 * nothing here imports the app's handle.
 *
 * Every function with `Owned` in its name takes the person's id second and
 * filters by it: knowing a task's id must never be enough to read it, or to
 * tick it.
 *
 * A task and its reminders are read as one statement, so a task comes back as
 * one row per reminder, and as a single row with no reminder in it when it
 * has none. mapTaskRows() in src/server/tasks.ts folds the rows back into
 * tasks.
 */

import "server-only";
import { and, asc, eq, gte, isNotNull, ne, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import { reminders, tasks } from "../schema";
import { daysBefore, keepOrNow } from "../sql";

/** The owner filter: this task is this person's. */
function ownedTask(userId: string) {
  return eq(tasks.userId, userId);
}

/** One task as a list row needs it. `dueDate` arrives as 'YYYY-MM-DD' and `dueTime` as 'HH:MM'. */
const taskColumns = {
  id: tasks.id,
  title: tasks.title,
  documentId: tasks.documentId,
  issuer: tasks.issuer,
  dueDate: tasks.dueDate,
  dueTime: tasks.dueTime,
  state: tasks.state,
};

/** One task beside one of its reminders, or beside none: what every statement here that reads a task answers with. */
export type TaskReminderRow = Awaited<
  ReturnType<typeof listOwnedTaskRows>
>[number];

/**
 * Every task of a person's that was not dismissed, with every reminder.
 *
 * Soonest due first, and a task with no date after every task that has one:
 * ascending order puts nulls last in PostgreSQL. Tasks due on the same day
 * stay in the order they were made, and each task's reminders run from the
 * earliest day to the latest.
 */
export async function listOwnedTaskRows(db: Db, userId: string) {
  return db
    .select({
      ...taskColumns,
      reminderId: reminders.id,
      reminderLocalDate: reminders.remindOn,
    })
    .from(tasks)
    .leftJoin(reminders, eq(reminders.taskId, tasks.id))
    .where(and(ownedTask(userId), ne(tasks.state, "dismissed")))
    .orderBy(
      asc(tasks.dueDate),
      asc(tasks.createdAt),
      asc(tasks.id),
      asc(reminders.remindOn),
      asc(reminders.id),
    );
}

/**
 * One task of a person's, with every reminder. No rows when there is no such
 * task, when it is somebody else's, when it was dismissed, or when the letter
 * it came from is gone.
 */
export async function findOwnedTaskRows(
  db: Db,
  userId: string,
  taskId: string,
) {
  return db
    .select({
      ...taskColumns,
      reminderId: reminders.id,
      reminderLocalDate: reminders.remindOn,
    })
    .from(tasks)
    .leftJoin(reminders, eq(reminders.taskId, tasks.id))
    .where(
      and(
        eq(tasks.id, taskId),
        ownedTask(userId),
        isNotNull(tasks.documentId),
        ne(tasks.state, "dismissed"),
      ),
    )
    .orderBy(asc(reminders.remindOn), asc(reminders.id));
}

/**
 * Change the tick of one task of a person's, and answer with the task as it
 * now is and every reminder, in one statement: the update is a CTE, and the
 * reminders are joined to the row it returns. No rows, and nothing changed,
 * when there is no such task, when it is somebody else's, or when it was
 * dismissed. The reminders are read and never written.
 */
function changeOwnedTaskRows(
  db: Db,
  userId: string,
  taskId: string,
  name: string,
  tick:
    | { state: "completed"; completedAt: SQL<Date> }
    | { state: "open"; completedAt: null },
) {
  const changed = db.$with(name).as(
    db
      .update(tasks)
      .set(tick)
      .where(
        and(
          eq(tasks.id, taskId),
          ownedTask(userId),
          ne(tasks.state, "dismissed"),
        ),
      )
      .returning(taskColumns),
  );

  return db
    .with(changed)
    .select({
      id: changed.id,
      title: changed.title,
      documentId: changed.documentId,
      issuer: changed.issuer,
      dueDate: changed.dueDate,
      dueTime: changed.dueTime,
      state: changed.state,
      reminderId: reminders.id,
      reminderLocalDate: reminders.remindOn,
    })
    .from(changed)
    .leftJoin(reminders, eq(reminders.taskId, changed.id))
    .orderBy(asc(reminders.remindOn), asc(reminders.id));
}

/**
 * Tick one task of a person's, and answer with it and its reminders.
 *
 * A task ticked a second time keeps the moment of the first tick (keepOrNow in
 * ../sql.ts).
 */
export async function completeOwnedTaskRows(
  db: Db,
  userId: string,
  taskId: string,
) {
  return changeOwnedTaskRows(db, userId, taskId, "completed_task", {
    state: "completed",
    completedAt: keepOrNow(tasks.completedAt),
  });
}

/** Untick one task of a person's, and answer with it and its reminders. The moment of the tick is forgotten. */
export async function reopenOwnedTaskRows(
  db: Db,
  userId: string,
  taskId: string,
) {
  return changeOwnedTaskRows(db, userId, taskId, "reopened_task", {
    state: "open",
    completedAt: null,
  });
}

/**
 * The ids of a person's tasks that were ticked within some days before an
 * instant. The instant is the caller's; the days are taken off it by the
 * database (daysBefore in ../sql.ts).
 */
export async function listOwnedRecentlyCompletedTaskIds(
  db: Db,
  userId: string,
  now: Date,
  windowDays: number,
): Promise<string[]> {
  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        ownedTask(userId),
        eq(tasks.state, "completed"),
        gte(tasks.completedAt, daysBefore(now, windowDays)),
      ),
    );
  return rows.map((row) => row.id);
}
