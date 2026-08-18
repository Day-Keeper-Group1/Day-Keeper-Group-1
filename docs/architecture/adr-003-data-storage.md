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
4. **Uploaded photographs never go in the database.** The tables hold a key; the
   bytes are objects in a bucket, reached only through `src/server/storage.ts`.
5. **That bucket is S3-protocol from the first day**, which locally means the
   MinIO in `docker-compose.yml` and later means whatever the host provides.

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

**No ORM.** The schema is fourteen tables. The interesting part of this backend is
the queries, and a teammate reading one should see exactly what reaches the
database. An ORM would add a second schema definition to keep in step with the
first, and a layer of generated SQL to debug through. `pg` with bound parameters
is enough, and nothing here is a string built by concatenation.

**Postgres in Docker rather than a hosted database.** One command, no account,
no credentials to hand out, works offline, and no risk of a teammate running
`db:reset` against something shared. The port is 55432 rather than 5432 so it
cannot collide with a Postgres somebody already runs for another unit.

**A bucket from the start rather than the server's disk.** Writing files to
disk during development and swapping in a bucket before deployment sounds like
the smaller step, and it is not. It is two implementations of storage, and the
second one gets written at the worst possible moment: during deployment, by
whoever is deploying, against code that by then has grown its own file-handling
habits in several places. Most hosts that run a Next.js app also throw the disk
away between deployments, so the disk version cannot even survive to be
migrated.

MinIO speaks the S3 protocol, so the code written against it today is the code
that runs against AWS S3, Cloudflare R2 or Supabase Storage later; the endpoint
and the credentials are environment variables, and nothing else moves. It is
one more service in a compose file that a teammate already runs, with its own
web viewer on 59001 next to the database viewer on 8080. The cost is a docker
service; what it buys is that the migration everybody worries about has already
been rehearsed.

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
- **Reminders are rows, not a rule.** Each one has its own fate to record
  (sent, skipped because the task was already done when its moment came, or
  failed), and a rule evaluated at read time cannot remember any of that.
  What writes those fates is the dispatcher at fire time, never the tick:
  see ADR 007.
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
  a complete world back in one second. It empties the bucket in the same breath,
  because rows and objects going out of step is how "it works on my machine"
  starts.
- Deployment still has to choose a host. Nothing here forecloses that: it is
  ordinary Postgres and an ordinary S3 bucket.
- Every teammate now runs one more container. `docker compose up -d` starts it
  with the rest, and `npm run db:reset` says plainly when it is not there.
- A signed link is signed for one address. While everything runs on a laptop
  there is only one; the day the app itself runs in a container there are two,
  and `STORAGE_PUBLIC_ENDPOINT` is the seam that already exists for it.
- Reading and writing bytes belongs in `src/server/storage.ts` and nowhere else.
  A route that hands out a link is still where ownership gets checked: a signed
  URL expires, but it does not ask who is holding it.

## Revisions

**18 August 2026.** Points 4 and 5 replace an earlier plan to write uploads to
the server's local disk and move to object storage "later". The reasoning is
under "A bucket from the start" above. The short version is that the later
migration would have landed in the middle of deployment week on whoever was
deploying, and that a rehearsed migration is worth more than a deferred one.
Local disk is not a smaller version of this; it is a different implementation
that would have to be removed.
