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
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * `now()`: the database's clock.
 *
 * The builder can only bind a value, and a value would be `new Date()`, the
 * clock of whichever copy of the app happened to run the statement. Written
 * as SQL, one clock stamps every row, whichever copy wrote it.
 */
export const dbNow = sql<Date>`now()`;

/**
 * `coalesce(column, now())`: the moment a column already holds, or the
 * database's now when it holds none.
 *
 * The builder has no coalesce. It is what makes a second tick of a task keep
 * the moment of the first: the column is stamped once, and every later write
 * hands it back what it already had.
 */
export function keepOrNow(column: AnyPgColumn) {
  return sql<Date>`coalesce(${column}, now())`;
}

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

/**
 * `(instant::timestamptz - make_interval(days => n))`: the instant a number of
 * days before another.
 *
 * The builder has no interval arithmetic. The instant is the caller's, bound
 * as the text of `toISOString()`; taking the days off it is left to the
 * database, as it was when this was written by hand, so what a day is when
 * the clocks change stays PostgreSQL's answer and never becomes JavaScript's.
 */
export function daysBefore(instant: Date, days: number) {
  return sql<Date>`(${instant.toISOString()}::timestamptz - make_interval(days => ${days}))`;
}

/**
 * `CASE column WHEN a THEN 1 WHEN b THEN 2 ... ELSE n END`: where a column's
 * value stands in a list, counted from 1, and one past the end for a value
 * the list does not hold.
 *
 * The builder has no CASE. It is for an ORDER BY that follows an order a
 * screen decided: the listed values first, in the order they are listed, and
 * everything else after them. What settles the order among everything else is
 * whatever the statement sorts by next, in the database, so that tie break is
 * the database's collation. Sorting the rows afterwards in JavaScript would
 * compare the same strings by another rule.
 *
 * Every value and every rank is bound. The ranks are cast, because a bare
 * parameter in a THEN is text to PostgreSQL, and as text 10 sorts before 2.
 */
export function rankOf(column: AnyPgColumn, values: readonly string[]) {
  const ranked = values.map(
    (value, index) => sql`WHEN ${value} THEN ${index + 1}::integer`,
  );
  return sql<number>`CASE ${column} ${sql.join(ranked, sql` `)} ELSE ${values.length + 1}::integer END`;
}
