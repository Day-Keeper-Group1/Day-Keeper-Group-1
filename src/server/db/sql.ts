// KAN-92: the SQL expressions the query builder cannot say, each under a name.

/**
 * Named SQL expressions.
 *
 * Every statement the app runs is written with Drizzle's query builder, in
 * ./queries. The builder has no word for a few things, and the database's own
 * clock is the first of them. Each is written here once, as SQL, under a name
 * that says what it means, with the reason the builder cannot say it beside
 * it. A queries file imports the name and writes no `sql` template of its own,
 * so this file and ./schema are the only places in the app where SQL text is
 * found.
 *
 * Server-only, like the queries files, which are its only readers.
 */

import "server-only";
import { sql } from "drizzle-orm";

/**
 * `now()`: the database's clock.
 *
 * The builder can only bind a value, and a value would be `new Date()`, the
 * clock of whichever copy of the app happened to run the statement. Written
 * as SQL, one clock stamps every row, whichever copy wrote it.
 */
export const dbNow = sql<Date>`now()`;

/**
 * `(date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz)`: the instant
 * today began in a time zone, by the database's clock.
 *
 * The builder has no date_trunc and no AT TIME ZONE. The inner AT TIME ZONE
 * turns the database's now into the time on a wall clock in that zone,
 * date_trunc winds that clock back to midnight, and the outer AT TIME ZONE
 * turns the midnight back into an instant. PostgreSQL does all three, so
 * daylight saving is its business, and the day turns at the same moment for
 * every copy of the app. The zone is bound, never spliced into the text.
 */
export function startOfTodayIn(timeZone: string) {
  return sql<Date>`(date_trunc('day', now() AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone})`;
}
