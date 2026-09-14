// KAN-57: the review screen's plan card, as lines, so the promise and the rows it becomes come from one place.

/**
 * What DayKeeper will do, in the order it will do it.
 *
 * The card is a promise, so every word of it is derived rather than typed here:
 * the reminders come from planReminders() and the wording from PLAN_LINES, both
 * in src/lib/contract/reminders.ts, beside the ladder itself. A schedule
 * written in one file and kept in another is how a card ends up promising a
 * reminder that never arrives.
 *
 * `today` is passed in rather than read, for the reason that module gives at
 * length: a bill photographed three days before it is due has already missed
 * its seven day reminder, and the screen must show the same list the confirm
 * handler will write. Both callers pass the same day, so both get the same
 * answer instead of the same function.
 *
 * An icon name rather than an icon, because this file is pure and lucide is a
 * component library. The screen maps the three names to Bell, CalendarDays and
 * FileText.
 */

import { formatDueDate, formatDueTime } from "@/lib/contract/dates";
import { PLAN_LINES, planReminders } from "@/lib/contract/reminders";

export type PlanLine = {
  icon: "bell" | "calendar" | "page";
  text: string;
};

/**
 * What the card says when the letter named no date.
 *
 * It states the absence and stops. There is no row for the missing date and no
 * box to put one in: the screen shows and it never asks, and the argument for
 * that is in src/lib/contract/api.ts. The tone is deliberate too, bark brown on
 * sandy yellow rather than an alarm colour, because nothing has gone wrong.
 */
export const NO_DATE_PLAN_LINE =
  "No date on this letter. It's saved; nothing goes on your calendar.";

export function planLinesFor(
  letter: { dueDate?: string; dueTime?: string },
  today: string,
  timeZone: string,
): PlanLine[] {
  if (!letter.dueDate) {
    return [{ icon: "page", text: NO_DATE_PLAN_LINE }];
  }

  const due = formatDueDate(letter.dueDate, "short");
  const lines: PlanLine[] = planReminders(letter.dueDate, {
    timeZone,
    today,
  }).map((reminder) => ({
    icon: "bell",
    text: PLAN_LINES.reminder(formatDueDate(reminder.localDate, "short")),
  }));

  // Exactly one line closes the card, chosen by whether the letter printed a
  // time of day. An appointment happens AT a time; a deadline happens BY a
  // date, and saying "due" is what makes the two read differently.
  lines.push({
    icon: "calendar",
    text: letter.dueTime
      ? PLAN_LINES.appointment(due, formatDueTime(letter.dueTime))
      : PLAN_LINES.deadline(due),
  });

  return lines;
}
