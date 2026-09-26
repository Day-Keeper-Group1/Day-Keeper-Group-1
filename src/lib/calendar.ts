// KAN-57: what the calendar screen draws, worked out from the tasks alone.

/**
 * The calendar, as arithmetic.
 *
 * Pure functions, kept out of the screen so the screen is only layout: which
 * days carry a dot, which boxes a month grid needs, and which tasks the list
 * beside the grid shows. None of them reads a clock, opens a database or
 * touches the DOM, so each is answerable in a test without a browser.
 *
 * Everything here speaks 'YYYY-MM-DD'. A calendar day is a calendar day, never
 * an instant: the reasoning, and the off-by-one bug it avoids, is at the top of
 * src/lib/contract/dates.ts.
 */

import type { TaskSummary } from "@/lib/contract/api";
import { addDays } from "@/lib/contract/dates";

/**
 * Every dated task, filed under the day it is due.
 *
 * KAN-62: a dot on the calendar means one thing, a task lands on that day.
 * Reminder days used to get a dot of their own, and the client read two
 * colours of dot as clutter. The yardstick is Google Calendar, which marks the
 * day a thing happens and nothing else; reminders are marked on Home instead
 * (src/lib/home.ts, reminderToday).
 *
 * Tasks are visited in the order given, so two tasks sharing a day always come
 * out in the same order. Nothing depends on that order being meaningful; it
 * depends on it being stable, so the grid does not reshuffle its dots between
 * renders.
 */
export function tasksByDueDay(
  tasks: TaskSummary[],
): Map<string, TaskSummary[]> {
  const byDay = new Map<string, TaskSummary[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const existing = byDay.get(task.dueDate);
    if (existing) existing.push(task);
    else byDay.set(task.dueDate, [task]);
  }
  return byDay;
}

/**
 * The boxes a month grid needs, Monday first.
 *
 * A date string for every day of the month, padded with nulls at both ends so
 * the first of the month sits under its weekday and the last row is full. The
 * length is therefore always a multiple of seven, which is what lets the screen
 * render one flat list into a seven-column grid.
 *
 * `month` is 1 to 12, matching how a person says it, rather than JavaScript's
 * 0 to 11. The conversion happens here once instead of at every call site,
 * which is where the off-by-one month usually gets in.
 */
export function monthCells(year: number, month: number): Array<string | null> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`monthCells expects a month of 1 to 12, got ${month}`);
  }

  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  // Day 0 of the next month is the last day of this one.
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay() counts from Sunday; this grid counts from Monday.
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const trail = (7 - ((lead + days) % 7)) % 7;

  const cells: Array<string | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let i = 0; i < days; i++) cells.push(addDays(first, i));
  for (let i = 0; i < trail; i++) cells.push(null);
  return cells;
}

/**
 * The Tasks panel, scoped to the month on screen.
 *
 * A list beside a month grid that lists every task the person owns grows
 * without limit and stops matching the grid it sits next to. This one says
 * what the grid says: the tasks due in the month being looked at, in date
 * order. Two things stay whatever month is showing. Overdue tasks are pinned
 * above, because an unpaid August bill must not vanish when she turns to
 * September; and dateless tasks sit below, because no month can claim them.
 * A ticked task keeps its month, so it is seen where it was done.
 *
 * `month` is 1 to 12, as in monthCells. Order within each group is the order
 * given, which the server already sorted by due date.
 */
export function tasksForMonth(
  tasks: TaskSummary[],
  year: number,
  month: number,
): { overdue: TaskSummary[]; inMonth: TaskSummary[]; undated: TaskSummary[] } {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  const overdue: TaskSummary[] = [];
  const inMonth: TaskSummary[] = [];
  const undated: TaskSummary[] = [];

  for (const task of tasks) {
    if (task.status === "overdue") overdue.push(task);
    else if (task.dueDate === null) undated.push(task);
    else if (task.dueDate.startsWith(prefix)) inMonth.push(task);
  }

  return { overdue, inMonth, undated };
}
