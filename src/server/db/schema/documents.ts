// KAN-92: letters and their photographed pages, as Drizzle tables.

/**
 * Letters
 *
 * A document is one piece of correspondence: one letter, one bill, one form.
 * A letter is often several sheets of paper, so the photographs hang off it in
 * document_pages. The unit a person thinks about is the letter, not the page,
 * and treating one photograph as one document would have made every task about
 * page three of a form.
 *
 * One upload is one letter, and every photograph in that upload belongs to it
 * (docs/scope.md). So a page knows which letter it is part of at the moment it
 * is stored, and no step between arriving and being read has to decide.
 *
 * Script-safe: no `server-only`, because drizzle-kit, the scripts in db/ and
 * Vitest load the schema outside Next.js, where that module throws.
 */

import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { timeOfDay, updatedAt } from "./columns";
import { documentStatus } from "./enums";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    status: documentStatus("status").notNull().default("processing"),
    // Everything down to `reference` is denormalised from the reading, so that
    // lists and the calendar do not join through extracted_fields on every
    // render. It is written the moment a reading SUCCEEDS, because the "to
    // check" list names who a letter is from before anybody has confirmed it,
    // and only from CONFIDENT values: a hedged date or an unreadable reference
    // stays NULL here, because a value the model was unsure of never reaches a
    // document, the calendar or a screen (src/lib/contract/api.ts). The hedge
    // itself is kept one table over, in extracted_fields.
    //
    // Nobody edits these by hand, and they are NULL until the reading
    // succeeds, which is why the browser-facing types declare them nullable.
    issuer: text("issuer"),
    documentType: text("document_type"),
    // A due date is a calendar day, not an instant: no zone and no time in
    // it. By default pg turns a `date` column into a JavaScript Date at
    // midnight in the server's local zone, which then serialises to UTC and
    // can land on the day before. For a product whose entire purpose is
    // telling someone when a bill is due, a date that quietly moves by one
    // day is the worst bug it could have. `mode: "string"` on this line is
    // what keeps the driver from doing that: every `date` column (this one,
    // tasks.due_date, reminders.remind_on) comes back as the string Postgres
    // stored, 'YYYY-MM-DD', and is carried around as that string everywhere.
    // The rules that keep it a day on the rest of the journey to a screen
    // are in src/lib/contract/dates.ts.
    dueDate: date("due_date", { mode: "string" }),
    // Appointments happen AT a time, not just BY a date. Null for everything
    // that only has a deadline. A 24-hour local wall clock; the zone is the
    // user's. The presence of a time is what makes a letter an appointment
    // when reminders are planned; see src/lib/contract/reminders.ts.
    dueTime: timeOfDay("due_time"),
    // Kept as written on the page: "$347.60", "347.60 AUD".
    amountText: text("amount_text"),
    reference: text("reference"),
    // Anything the reading returned that is not one of the six contract
    // fields. Untyped on purpose: six is a floor rather than a ceiling
    // (src/lib/contract/fields.ts), and this is where the ceiling goes until a
    // field is worth promoting.
    openPayload: jsonb("open_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "documents_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("cascade"),
    // One-way implication, not an equality. A person can archive a letter they
    // already confirmed, and when they do the status becomes 'archived' while
    // confirmed_at has to survive: it is the record that a human checked this
    // letter, which is what the calendar's trustworthiness rests on. Written
    // as an equality, these two constraints would make archiving a confirmed
    // letter impossible without erasing that record.
    check(
      "documents_confirmed_has_timestamp",
      sql`${t.status} <> 'confirmed' OR ${t.confirmedAt} IS NOT NULL`,
    ),
    check(
      "documents_archived_has_timestamp",
      sql`(${t.status} = 'archived') = (${t.archivedAt} IS NOT NULL)`,
    ),
    // Newest first. Written .desc().nullsFirst() because that is what
    // PostgreSQL's own DESC means; Drizzle's bare .desc() says NULLS LAST,
    // which is a different index.
    index("documents_user_uploaded_idx").on(
      t.userId,
      t.uploadedAt.desc().nullsFirst(),
    ),
    index("documents_user_status_idx").on(t.userId, t.status),
    index("documents_user_due_idx")
      .on(t.userId, t.dueDate)
      .where(sql`${t.dueDate} IS NOT NULL`),
  ],
);

/**
 * One photographed sheet. The bytes live in the object store; this row holds
 * the key and enough about the image to lay out a thumbnail without fetching
 * it first.
 *
 * page_number is the order the photographs were taken, and the order the
 * letters area shows them in. A person works through a form front to back
 * without being asked to, so nothing has to be decided here.
 */
export const documentPages = pgTable(
  "document_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull(),
    pageNumber: integer("page_number").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "document_pages_document_id_fkey",
      columns: [t.documentId],
      foreignColumns: [documents.id],
    }).onDelete("cascade"),
    check("document_pages_page_number_positive", sql`${t.pageNumber} >= 1`),
    check("document_pages_byte_size_positive", sql`${t.byteSize} > 0`),
    // Also the index a letter's pages are read by, in order. Postgres builds
    // one for the constraint, so a second index on the same two columns would
    // only be another thing to keep updated.
    unique("document_pages_unique_page").on(t.documentId, t.pageNumber),
  ],
);
