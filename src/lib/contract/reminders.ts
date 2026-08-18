/**
 * The reminder scheduling rule.
 *
 * This rule used to live only inside the seed script, which the browser cannot
 * reach. It has to live here because two different people need the identical
 * answer: whoever writes the confirm handler (which creates the reminder rows)
 * and whoever builds the review screen (whose "What DayKeeper will do" card
 * shows the person the plan before they agree to it). Two copies of a schedule
 * is how the card ends up promising a reminder that never arrives.
 *
 * The rule, read off the product prototype:
 *
 * - A deadline (a bill, a form, anything you act on BY a date) gets three
 *   reminders: seven days, three days and one day before, at 9 am.
 *   (Decided 18 August 2026: for a bill due the 18th they land on the 11th,
 *   the 15th and the 17th.)
 * - An appointment (anything you attend AT a time) gets one reminder, the day
 *   before, at 9 am. Nobody needs a nudge a week before the dentist, and the
 *   day itself is on the calendar.
 *
 * What makes something an appointment: it has a time of day (`due_time` is
 * present). That is a default decision recorded here so it can be argued with
 * at review, not silently in the seed.
 */

import { APP_TIME_ZONE, addDays, zonedTimeToInstant } from "./dates";

/** The local wall-clock hour reminders go out. "9 am" is product copy. */
export const REMINDER_HOUR_LOCAL = 9;

/**
 * That hour as the product says it out loud: "9 am".
 *
 * Derived rather than typed, because the review screen's plan card repeats this
 * string on every row and the day sheet repeats it again. `formatDueTime()`
 * would give "9:00 am", which is right for an appointment printed on a letter
 * and wrong for a phrase a person reads five times a week.
 */
export const REMINDER_TIME_SPOKEN = `${REMINDER_HOUR_LOCAL % 12 || 12} ${
  REMINDER_HOUR_LOCAL < 12 ? "am" : "pm"
}`;

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
  reminder: (date: string) => `Remind you: ${date}, ${REMINDER_TIME_SPOKEN}`,
  deadline: (date: string) => `On your calendar: due ${date}`,
  appointment: (date: string, time: string) =>
    `On your calendar: ${date}, ${time}`,
} as const;

/** Days before the due date, for something you act on by a date. */
export const DEADLINE_REMINDER_OFFSET_DAYS = [7, 3, 1] as const;

/** Days before the appointment, for something you attend at a time. */
export const APPOINTMENT_REMINDER_OFFSET_DAYS = [1] as const;

export type PlannedReminder = {
  /** How many days before the due date this reminder lands. */
  offsetDays: number;
  /** The calendar day it lands on, 'YYYY-MM-DD'. This is what a calendar dot is. */
  localDate: string;
  /** The wall clock it lands at, 'HH:mm'. Always 09:00 today. */
  localTime: string;
  /** The absolute instant, for the reminders.scheduled_for column. */
  scheduledFor: Date;
};

/**
 * Plan the reminders for a due date.
 *
 * Pure: same input, same answer, no clock of its own. `today` is passed in
 * rather than read, so the same call can be replayed and tested.
 *
 * **Both product callers must pass the same `today`.** The review screen shows
 * this list to a person as a promise and the confirm handler turns it into
 * rows, and a bill photographed three days before it is due plans a reminder
 * for last week. If the screen kept that row and the handler dropped it, the
 * card would promise a reminder that never arrives, which is the exact failure
 * this module exists to prevent. Passing the day makes both answers the same
 * list rather than the same function.
 *
 * Omitting `today` returns every offset, past ones included. That is for the
 * seed, which is building a world that already happened and marks those rows
 * `sent`.
 */
export function planReminders(
  dueDate: string,
  options: { hasTime: boolean; timeZone?: string; today?: string },
): PlannedReminder[] {
  const timeZone = options.timeZone ?? APP_TIME_ZONE;
  const offsets = options.hasTime
    ? APPOINTMENT_REMINDER_OFFSET_DAYS
    : DEADLINE_REMINDER_OFFSET_DAYS;

  return offsets
    .map((offsetDays) => {
      const localDate = addDays(dueDate, -offsetDays);
      return {
        offsetDays,
        localDate,
        localTime: `${String(REMINDER_HOUR_LOCAL).padStart(2, "0")}:00`,
        scheduledFor: zonedTimeToInstant(
          localDate,
          REMINDER_HOUR_LOCAL,
          0,
          timeZone,
        ),
      };
    })
    .filter((r) => options.today === undefined || r.localDate >= options.today);
}
