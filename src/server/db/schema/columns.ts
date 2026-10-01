// KAN-92: the two column shapes that more than one table declares.

/**
 * Columns written once and used by several tables: a time of day, and
 * updated_at.
 *
 * Script-safe: no `server-only`, because drizzle-kit, the scripts in db/ and
 * Vitest load the schema outside Next.js, where that module throws.
 */

import { sql } from "drizzle-orm";
import { customType, timestamp } from "drizzle-orm/pg-core";

/** A wall clock time: stored as `time`, carried as 'HH:MM' wherever it is read. */
export const timeOfDay = customType<{ data: string; driverData: string }>({
  dataType() {
    return "time";
  },
  fromDriver(value) {
    return value.slice(0, 5); // PostgreSQL prints HH:MM:SS; the wire format is HH:MM
  },
});

/**
 * updated_at maintenance.
 *
 * Three tables carry updated_at (users, documents, tasks), and every
 * statement that forgets to set it leaves a row claiming it has not changed
 * since the day it was made. So the column sets itself: every UPDATE made
 * through the Drizzle builder writes `updated_at = now()` without the query
 * asking for it. A statement sent any other way, a hand-run UPDATE or
 * `db.execute`, does not, and tests/db/updated-at.test.ts holds every writer
 * in the app to it.
 *
 * `now()` rather than `new Date()`: the database's clock, so every row is
 * stamped by one clock whichever copy of the app wrote it.
 */
export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`);
