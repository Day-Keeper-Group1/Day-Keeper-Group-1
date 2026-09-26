/**
 * Dates and times, in one place.
 *
 * Every date in this system travels as a calendar day, 'YYYY-MM-DD'. Every time
 * of day travels as a wall clock, 'HH:mm'. Instants (timestamptz columns, Date
 * objects) are only ever records of when something happened, never dates a
 * person reads.
 *
 * Dates are date-only because that is what they are. A due date is printed on a
 * piece of paper: the 15th of August, no hour, no zone. Turning it into an
 * instant invents both, and the invention surfaces as a day off by one, which
 * for this product is the worst available bug. A reminder marked a day late is
 * worse than no reminder, because she stopped watching for the letter.
 *
 * There are two directions the invention can creep in, and they are guarded in
 * two places:
 *
 * - src/server/db.ts stops the driver turning a `date` column into a shifted
 *   JavaScript Date on the way OUT of the database.
 * - this module stops arithmetic and formatting shifting the day on the way TO
 *   the screen. `new Date('2026-08-15')` parses as UTC midnight, which in any
 *   zone behind UTC formats back as the 14th. Nothing in this file ever
 *   constructs a Date from a bare date string.
 *
 * Pure functions only: no database, no environment, no `server-only`. The
 * review screen and the seed script both import from here, which is the point.
 * One rule, one home.
 */

/**
 * The application's timezone: Melbourne.
 *
 * "Today" is meaningless without a zone, and so is everything decided from it:
 * "overdue", which compares calendar days in the person's zone rather than
 * instants (see deriveTaskStatus in ./api.ts), and whether today is one of a
 * task's reminder days.
 *
 * Users carry a `timezone` column defaulted to this value, so the server should
 * prefer the person's own zone whenever it has a session; this constant is the
 * default for new accounts and the fallback for code with no user in hand.
 * One zone per deployment is a deliberate simplification for a Melbourne pilot,
 * not an oversight, and the column is what makes undoing it a change of data
 * rather than a change of design.
 *
 * Melbourne is UTC+10 in winter and UTC+11 in summer, and its winter is the
 * northern summer, so a test of "today" that passes in one season proves
 * nothing about the other.
 */
export const APP_TIME_ZONE = "Australia/Melbourne";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** True for a real calendar date written 'YYYY-MM-DD'. '2026-02-30' is false. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

function assertIsoDate(value: string, caller: string): void {
  if (!isIsoDate(value)) {
    throw new TypeError(`${caller} expects 'YYYY-MM-DD', got "${value}"`);
  }
}

/**
 * Today's date in a timezone, as 'YYYY-MM-DD'.
 *
 * This is how "is it overdue yet?" must be asked. Comparing against UTC's
 * midnight makes a Melbourne task stay upcoming until ten the next morning.
 */
export function todayInZone(
  timeZone: string = APP_TIME_ZONE,
  now: Date = new Date(),
): string {
  // en-CA is the locale whose default date format is YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Calendar arithmetic on 'YYYY-MM-DD', no timezone involved. Days may be negative. */
export function addDays(isoDate: string, days: number): string {
  assertIsoDate(isoDate, "addDays");
  const [y, mo, d] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, mo - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}

/** Whole days from one 'YYYY-MM-DD' to another: 1 from today to tomorrow. */
export function daysBetween(from: string, to: string): number {
  assertIsoDate(from, "daysBetween");
  assertIsoDate(to, "daysBetween");
  const utc = (iso: string) => {
    const [y, mo, d] = iso.split("-").map(Number);
    return Date.UTC(y, mo - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/**
 * The three ways the interface writes a date, taken from the prototype:
 *
 *   fact   '15 Aug 2026'         the review screen's field rows
 *   short  'Sat 15 Aug'          task rows and day-sheet headers
 *   long   'Saturday 15 August'  spoken-style, for the day sheet's title
 *
 * Deliberately hand-rolled rather than Intl: locale data varies between ICU
 * versions (a comma appearing in 'Sat, 15 Aug' depending on the Node build),
 * and these three strings are product copy, not localisation.
 */
export function formatDueDate(
  isoDate: string,
  style: "fact" | "short" | "long",
): string {
  assertIsoDate(isoDate, "formatDueDate");
  const [y, mo, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  switch (style) {
    case "fact":
      return `${d} ${MONTHS_SHORT[mo - 1]} ${y}`;
    case "short":
      return `${WEEKDAYS_SHORT[weekday]} ${d} ${MONTHS_SHORT[mo - 1]}`;
    case "long":
      return `${WEEKDAYS_LONG[weekday]} ${d} ${MONTHS_LONG[mo - 1]}`;
  }
}

/** '10:30' → '10:30 am', '14:05' → '2:05 pm'. The prototype's appointment style. */
export function formatDueTime(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new TypeError(`formatDueTime expects 'HH:mm', got "${hhmm}"`);
  const hour = Number(m[1]);
  const minute = m[2];
  if (hour > 23 || Number(minute) > 59) {
    throw new TypeError(`formatDueTime expects a real time, got "${hhmm}"`);
  }
  const half = hour < 12 ? "am" : "pm";
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${clock}:${minute} ${half}`;
}

/**
 * Parse human date writing, day-first, to 'YYYY-MM-DD'.
 *
 * Dormant this version: nothing collects a typed date any more, because nothing
 * on any screen is editable (./api.ts) and the date-filling feature was
 * deferred rather than rejected. Kept because the rules are right, and the day
 * it comes back is the day this would otherwise be rewritten from scratch and
 * get day-first wrong. Accepted:
 *
 *   '2026-08-15'      already ISO
 *   '15/08/2026'      day-first with / - or . and a 2- or 4-digit year
 *   '15 Aug 2026'     day, month name (short or full), year
 *
 * Anything else, and any string that names an impossible day, returns null.
 * Day-first is a product decision, not a guess: the audience is Australian.
 */
export function parseHumanDate(input: string): string | null {
  const text = input.trim();
  if (ISO_DATE.test(text)) return isIsoDate(text) ? text : null;

  const slashed = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/.exec(text);
  if (slashed) {
    const d = Number(slashed[1]);
    const mo = Number(slashed[2]);
    const y =
      slashed[3].length === 2 ? 2000 + Number(slashed[3]) : Number(slashed[3]);
    const iso = `${y}-${pad2(mo)}-${pad2(d)}`;
    return isIsoDate(iso) ? iso : null;
  }

  const written = /^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/.exec(text);
  if (written) {
    const d = Number(written[1]);
    const name = written[2].toLowerCase();
    const y = Number(written[3]);
    const mo =
      MONTHS_SHORT.findIndex((m) => m.toLowerCase() === name.slice(0, 3)) + 1;
    const isFullName = MONTHS_LONG.some((m) => m.toLowerCase() === name);
    const isShortName = MONTHS_SHORT.some((m) => m.toLowerCase() === name);
    if (mo === 0 || !(isFullName || isShortName)) return null;
    const iso = `${y}-${pad2(mo)}-${pad2(d)}`;
    return isIsoDate(iso) ? iso : null;
  }

  return null;
}
