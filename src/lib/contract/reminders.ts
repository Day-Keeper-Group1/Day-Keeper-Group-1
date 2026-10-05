/**
 * The reminder ladder.
 *
 * The ladder used to live only inside the seed script, which the browser cannot
 * reach. It lives here because two different people need the identical answer:
 * whoever writes the confirm handler, which writes the reminder rows, and
 * whoever builds the screen whose "What DayKeeper will do" card shows the person
 * the plan before they agree to it. Two copies of a schedule is how the card ends
 * up promising a reminder that never comes.
 *
 * ## The ladder
 *
 * Everything gets the same three reminders: **seven days, three days and one
 * day before** the due date. For a bill due the 18th they fall on the 11th, the
 * 15th and the 17th, and a two o'clock appointment on the 18th gets the same
 * three days.
 *
 * One ladder rather than one per kind of document. A document that names a
 * time of day still shows that time on the calendar, but it is not a different
 * sort of thing to be reminded about.
 *
 * ## What a reminder is
 *
 * KAN-62: a day, not a message. On a reminder day, Home marks the task's own
 * row: a tint, a bell, and how far off the due date is. Nothing is sent, so
 * there is no hour, no channel and nothing to record about whether it went
 * out. A task that has been ticked is simply not marked; ticking writes
 * nothing to reminders, and unticking brings the marks back because they were
 * never taken away.
 *
 * The rows are still planned and written at confirm time rather than worked
 * out later, because of the one rule that needs the confirm day: a reminder
 * that would fall on that day or before it is never planned. She has just
 * looked at the letter, and a mark on the row she has just made would be
 * noise.
 */

import { addDays } from "./dates";

/**
 * The three lines the review screen's "What DayKeeper will do" card shows.
 *
 * They live here, beside the rule they describe, for the same reason the rule
 * itself does: the card is a promise, and a promise written in one file and
 * kept in another drifts. The first is one row per planned reminder; exactly
 * one of the other two closes the card, chosen by whether the document names a
 * time of day.
 *
 * The wording is the product prototype's, verbatim.
 */
export const PLAN_LINES = {
  reminder: (date: string) => `Remind you: ${date}`,
  deadline: (date: string) => `On your calendar: due ${date}`,
  appointment: (date: string, time: string) =>
    `On your calendar: ${date}, ${time}`,
} as const;

/** Days before the due date. Every document gets these three. */
export const REMINDER_OFFSET_DAYS = [7, 3, 1] as const;

export type PlannedReminder = {
  /** How many days before the due date this reminder falls. */
  offsetDays: number;
  /** The day it falls on, 'YYYY-MM-DD', in her zone. */
  localDate: string;
};

/**
 * Plan the reminders for a due date.
 *
 * Pure: same input, same answer, no clock of its own. `today` is passed in
 * rather than read, so the same call can be replayed and tested.
 *
 * **Both product callers must pass the same `today`.** The review screen shows
 * this list to a person as a promise and the confirm handler turns it into
 * rows. If the screen kept a day the handler dropped, the card would promise a
 * reminder that never comes, which is the exact failure this module exists to
 * prevent. Passing the day makes both answers the same list rather than the
 * same function.
 *
 * With `today`, only days after it are kept: a bill confirmed three days
 * before it is due gets the one day reminder and not a mark today. Omitting
 * `today` returns every offset, past ones included. That is for the seed,
 * which is building a world that already happened.
 */
export function planReminders(
  dueDate: string,
  options: { today?: string } = {},
): PlannedReminder[] {
  return REMINDER_OFFSET_DAYS.map((offsetDays) => ({
    offsetDays,
    localDate: addDays(dueDate, -offsetDays),
  })).filter((r) => options.today === undefined || r.localDate > options.today);
}
