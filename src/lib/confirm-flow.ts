// KAN-59: checking one letter after another, worked out away from the screen.

/**
 * What happens after "Looks right, save it".
 *
 * The saved letter goes, a note says what was kept and where, and she is taken
 * straight to the next letter waiting, first photographed first. When none is
 * left she lands where the letters she just saved went: the calendar, at the
 * month of the last task she saved, or Your letters if none of them made a
 * task. "Not now", or any other screen, ends the run, and the next one starts
 * from nothing.
 *
 * The run is carried in the address of the next review screen (`?run=`) rather
 * than kept anywhere, so there is nothing to clear when she leaves: an address
 * without it is a run just starting. It holds only where to land, never a
 * count: "3 left to check" is counted from the letters themselves every time
 * the screen is drawn, so leaving and coming back says what is true then.
 *
 * Pure, so the rules can be tested without a browser.
 */

import type { TaskSummary } from "@/lib/contract/api";
import { formatDueDate } from "@/lib/contract/dates";

/** Where to land when the last letter is saved, as far as the run knows yet. */
export type Run = {
  /** Whether any letter saved in this run made a task. */
  anyTask: boolean;
  /** The month of the last dated task saved, 'YYYY-MM', or null. */
  month: string | null;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The run as the address carries it: absent, "task", or a month. */
export function parseRun(value: string | null | undefined): Run {
  if (value && MONTH.test(value)) return { anyTask: true, month: value };
  if (value === "task") return { anyTask: true, month: null };
  return { anyTask: false, month: null };
}

/** The run as the address carries it, or null when there is nothing to carry. */
export function encodeRun(run: Run): string | null {
  if (run.month) return run.month;
  return run.anyTask ? "task" : null;
}

/** The run once one more letter has been saved. */
export function runAfter(run: Run, task: TaskSummary | null): Run {
  if (!task) return run;
  return {
    anyTask: true,
    month: task.dueDate ? task.dueDate.slice(0, 7) : run.month,
  };
}

/** Where the next screen is: the next letter waiting, or where the run lands. */
export function nextHref(run: Run, nextLetterId: string | null): string {
  if (nextLetterId) {
    const carried = encodeRun(run);
    return `/documents/${nextLetterId}/review${carried ? `?run=${carried}` : ""}`;
  }
  if (!run.anyTask) return "/documents";
  return run.month ? `/calendar?month=${run.month}` : "/calendar";
}

/** A month the calendar may open at, from its address, or null. */
export function monthParam(value: string | null | undefined): string | null {
  return value && MONTH.test(value) ? value : null;
}

/**
 * The note after a save, in the prototype's words.
 *
 * `action` is what the card said to do ("Pay Yarra Valley Water"); `letter` is
 * what the letter is called ("Wattlebank Super · Annual statement"), which is
 * all there is to say about a letter that asked for nothing.
 */
export function savedNote(
  task: TaskSummary | null,
  action: string | null,
  letter: string,
): string {
  if (!task) return `Saved. ${letter} is kept in your letters.`;
  const what = action ?? task.title;
  return task.dueDate
    ? `Saved. ${what} is on your calendar for ${formatDueDate(task.dueDate, "short")}.`
    : `Saved. ${what} is on your list, with no date.`;
}

/** How many letters are waiting, this one included, in the prototype's words. */
export function leftToCheck(waiting: number): string {
  return waiting > 1 ? `${waiting} left to check` : "Last one to check";
}
