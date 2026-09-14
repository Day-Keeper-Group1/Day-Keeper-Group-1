// KAN-57: what the calendar screen draws, worked out from the tasks alone.

/**
 * The calendar, as arithmetic.
 *
 * Three pure functions, kept out of the screen so the screen is only layout:
 * which days carry a dot, which boxes a month grid needs, and what the day
 * sheet says about a reminder. None of them reads a clock, opens a database or
 * touches the DOM, so each is answerable in a test without a browser.
 *
 * Everything here speaks 'YYYY-MM-DD'. A calendar day is a calendar day, never
 * an instant: the reasoning, and the off-by-one bug it avoids, is at the top of
 * src/lib/contract/dates.ts.
 */

import type { ReminderView, TaskSummary } from "@/lib/contract/api";
import { addDays } from "@/lib/contract/dates";
import { REMINDER_TIME_SPOKEN } from "@/lib/contract/reminders";

/**
 * One thing a day carries.
 *
 * A due mark is the task landing; a reminder mark is one of the three mornings
 * before it. Both hold the whole task rather than an id, because the day sheet
 * draws the task's own row from it and the screen has nowhere else to look it
 * up. `reminder` is present exactly when `kind` is 'reminder'.
 */
export type CalendarMark = {
  kind: "due" | "reminder";
  task: TaskSummary;
  reminder?: ReminderView;
};

/**
 * Every mark, filed under the day it falls on.
 *
 * Reminders are filed by `localDate`, the day the server already bucketed them
 * into in the person's zone, so the browser never turns an instant back into a
 * day and gets it wrong by one. See ReminderView in src/lib/contract/api.ts.
 *
 * Tasks are visited in the order given and a task's own due mark is filed
 * before its reminders, so two tasks sharing a day always come out in the same
 * order. Nothing depends on that order being meaningful; it depends on it being
 * stable, so the grid does not reshuffle its dots between renders.
 */
export function marksByDay(tasks: TaskSummary[]): Map<string, CalendarMark[]> {
  const byDay = new Map<string, CalendarMark[]>();

  function file(day: string, mark: CalendarMark): void {
    const existing = byDay.get(day);
    if (existing) existing.push(mark);
    else byDay.set(day, [mark]);
  }

  for (const task of tasks) {
    if (task.dueDate) file(task.dueDate, { kind: "due", task });
    for (const reminder of task.reminders) {
      file(reminder.localDate, { kind: "reminder", task, reminder });
    }
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
 * What the day sheet says about a reminder.
 *
 * This sentence is the clock check, drawn. The dispatcher reads the tick at the
 * moment a reminder rings (src/lib/contract/reminders.ts), so a reminder for a
 * task already ticked has nothing to say, and one whose morning has passed is
 * history rather than a plan. Saying "will remind you" about yesterday is the
 * small lie that teaches a person to stop trusting the rest of the screen.
 *
 * The hour comes from REMINDER_TIME_SPOKEN rather than being typed here, so the
 * day the hour becomes a setting this sentence does not quietly start lying
 * about that too.
 */
export function sheetLine(mark: CalendarMark, today: string): string {
  if (mark.task.status === "completed") {
    return "No reminder, this is already done";
  }
  const day = mark.reminder?.localDate ?? mark.task.dueDate;
  return day !== null && day < today
    ? `A reminder went out this morning, ${REMINDER_TIME_SPOKEN}`
    : `A reminder goes out this morning, ${REMINDER_TIME_SPOKEN}`;
}
