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
 * - A deadline (a bill, a form, anything you act on BY a date) gets two
 *   reminders: seven days before and one day before, at 9 am.
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

/** Days before the due date, for something you act on by a date. */
export const DEADLINE_REMINDER_OFFSET_DAYS = [7, 1] as const;

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
 * Pure: same input, same answer, no clock. Reminders whose date has already
 * passed are still returned; whether to create them as 'sent', skip them, or
 * schedule them anyway is the caller's business (the seed marks them sent, a
 * confirm handler should simply not create them).
 */
export function planReminders(
  dueDate: string,
  options: { hasTime: boolean; timeZone?: string },
): PlannedReminder[] {
  const timeZone = options.timeZone ?? APP_TIME_ZONE;
  const offsets = options.hasTime
    ? APPOINTMENT_REMINDER_OFFSET_DAYS
    : DEADLINE_REMINDER_OFFSET_DAYS;

  return offsets.map((offsetDays) => {
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
  });
}
