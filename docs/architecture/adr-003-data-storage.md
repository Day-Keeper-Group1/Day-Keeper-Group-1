# ADR 003: Plain Postgres, one schema file, no migrations

Status: accepted, 9 August 2026
Decision by: Jason (technical lead)

## Context

We need a database everyone can run today, a schema everyone agrees on, and a
story for changing it while five people are working at once.

The roadmap asks for "SQL migrations". Migrations are the right answer for a
system with data you cannot lose. We have neither users nor data, and we have
one person writing the schema and four people about to write features against
it. The schema will change several times a week for the next fortnight.

## Decision

1. **PostgreSQL, spoken as plain SQL through `pg`.** No ORM.
2. **`db/schema.sql` is the single source of truth.** There are no migration
   files. To change the schema you edit that file and run `npm run db:reset`,
   which drops everything and rebuilds it, then reseeds.
3. **Local development runs Postgres in Docker**, started by
   `docker compose up -d`. Nothing about the schema is specific to any host: the
   same file runs on Supabase, on RDS, or on a laptop.
4. **Uploaded photographs never go in the database.** The tables hold a path;
   the bytes live behind a storage interface, which is local disk today and an
   object store later.

## Why

**No migrations, for now.** Migrations solve the problem of changing a database
you cannot drop. We can drop ours. What migrations would actually give us this
month is a folder of files that must be applied in order, that conflict when two
people write one in the same week, and that can leave two teammates on
subtly different schemas. Rebuilding from a single file means everyone's
database is identical to everyone else's, always, and the diff of a schema
change is a diff of the schema rather than an instruction for reaching it.

This is a decision with an expiry date. **The moment anything real is stored,
this stops being safe**, and the first migration tool arrives before the first
real user does. `db/reset.ts` refuses to run against a non-local database
without an explicit override, so nobody discovers this the hard way.

**No ORM.** The schema is ten tables. The interesting part of this backend is
the queries, and a teammate reading one should see exactly what reaches the
database. An ORM would add a second schema definition to keep in step with the
first, and a layer of generated SQL to debug through. `pg` with bound parameters
is enough, and nothing here is a string built by concatenation.

**Postgres in Docker rather than a hosted database.** One command, no account,
no credentials to hand out, works offline, and no risk of a teammate running
`db:reset` against something shared. The port is 55432 rather than 5432 so it
cannot collide with a Postgres somebody already runs for another unit.

## Shape decisions worth naming

- **A document is a letter; its pages are rows in `document_pages`.** A letter
  is often several sheets. Treating one photo as one document would have made
  every task about page three of a form.
- **Extraction history is kept.** Every attempt, including failures, with the
  provider's raw response. Deleting the history would make honest accuracy
  reporting impossible and would hide how often a person had to retake a photo.
- **Corrections sit beside the model's answer, never on top of it.**
  `extracted_fields` holds both `extracted_value` and `corrected_value`.
  Overwriting would destroy the only evidence of how often the reader is wrong.
- **Reminders are rows, not a rule.** Each one can be sent, cancelled, or fail
  individually, and a rule evaluated at read time cannot remember any of that.
- **`upcoming` and `overdue` are derived, not stored.** A task becomes overdue
  because time passed, and nothing in the system wakes at midnight to write that
  down. Storing it would guarantee it goes stale.
- **`date` columns are read as strings.** By default the driver turns a date
  into a timestamp in the server's zone, which can move a due date to the day
  before. For a product about deadlines that is the worst available bug, so the
  parser is overridden in `src/server/db.ts`.
- **Statuses are spelled the way the interface already spells them**
  (`needs-review`, not `needs_review`), so a status travels from a table to the
  screen without being translated. Field keys stay snake_case because that is
  what the extraction contract calls them.

## Consequences

- `npm run db:reset` destroys local data. That is the point, and the seed puts
  a complete world back in one second.
- Deployment still has to choose a host. Nothing here forecloses that: it is
  ordinary Postgres.
- Object storage is not wired up. It belongs behind an interface at
  `src/server/storage.ts`, handing out URLs through a route that checks
  ownership, so that swapping local disk for a bucket changes no caller.
