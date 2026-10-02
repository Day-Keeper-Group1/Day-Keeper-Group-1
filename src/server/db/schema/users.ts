// KAN-92: people and their sessions, as Drizzle tables.

/**
 * People
 *
 * Script-safe, for the reason ./index.ts gives.
 */

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { updatedAt } from "./columns";
import { userRole } from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    // Case- and whitespace-insensitive uniqueness. Margaret will type
    // " Margaret.W@Example.COM " and expect to be let in.
    emailCanonical: text("email_canonical").generatedAlwaysAs(
      sql`lower(btrim(email))`,
    ),
    displayName: text("display_name").notNull(),
    // What hashes this, and why sessions are rows rather than a signed cookie:
    // src/server/auth/.
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("user"),
    // IANA zone name. "Today", "overdue" and "a reminder today" are all days,
    // and a day is meaningless without knowing whose. Defaulted rather than
    // asked for at registration; a settings screen can expose it later.
    timezone: text("timezone").notNull().default("Australia/Melbourne"),
    // Deactivating a person stops them signing in and leaves their letters
    // intact. A timestamp rather than a boolean, because when it happened is
    // worth as much as that it happened. Nothing deletes a person.
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("users_email_present", sql`btrim(${t.email}) <> ''`),
    check("users_display_name_present", sql`btrim(${t.displayName}) <> ''`),
    check("users_timezone_present", sql`btrim(${t.timezone}) <> ''`),
    uniqueIndex("users_email_canonical_key").on(t.emailCanonical),
  ],
);

/**
 * The cookie carries a token; this row is the session itself. Keeping the
 * session here rather than inside the cookie is what lets signing out, a
 * deactivated account or a stolen laptop end one immediately. See
 * src/server/auth/.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    // The hash of the cookie value, never the value. The plaintext token does
    // not touch the database, so a database leak does not hand over live
    // sessions.
    tokenHash: text("token_hash").notNull().unique("sessions_token_hash_key"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
  },
  (t) => [
    foreignKey({
      name: "sessions_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);
