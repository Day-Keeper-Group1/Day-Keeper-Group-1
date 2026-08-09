# Start here

What this branch gives you, and what is yours to build.

## What is here

Three things, and deliberately only three:

1. **A database** everyone can run in one command, with a schema that is already
   settled and seed data covering every state the interface has to draw.
2. **The contract**: the six fields, in TypeScript, with a validator. This is the
   agreement between whoever reads a document and whoever turns it into a task,
   and it is the one thing that has to be settled before two people can work in
   parallel.
3. **A mock reader** that behaves like a real one will, so the whole flow can be
   built and demonstrated before anyone has model access.

**The API and the pages are not here. That is the work.** `docs/api.md` is the
specification for them: the endpoints, their shapes, their status codes and the
reasoning. Build against it and the pieces will fit together.

## Running it

You need Node 20.17 or newer, npm 11 or newer, and Docker Desktop.

```bash
npm ci                    # exactly what package-lock.json says
cp .env.example .env.local
docker compose up -d      # Postgres on 55432, a database viewer on 8080
docker compose ps         # wait until db says "healthy", usually a few seconds
npm run db:reset          # build the schema, then seed it
npm test                  # the contract tests
```

On Windows, run these in PowerShell or Git Bash. In `cmd.exe` there is no `cp`;
use `copy .env.example .env.local`.

The database viewer is at http://localhost:8080. Server `db`, user, password and
database are all `daykeeper`. That is the quickest way to see what the seed put
in the tables.

### If something goes wrong

**`npm ci` complains about your npm version.** That is the guard working: run
`npm i -g npm@11`. Different npm versions write `package-lock.json` differently,
and the resulting churn wastes everyone's time.

**`npm run db:reset` cannot connect.** The container is up but Postgres inside
it is still starting. `docker compose up -d` returns before the health check
passes. Wait for `docker compose ps` to show `healthy` and run it again.

**Port 8080 is already in use.** Something else on your machine has it; it is a
popular port. Change the left-hand number under `adminer` in
`docker-compose.yml` to something free, for example `8081:8080`. Postgres is on
55432 rather than 5432 for the same reason, so that one rarely collides.

### What the seed gives you

Margaret's world at the moment she opens the app, with every state the interface
has to draw already present, so you never have to manufacture one:

- a letter **waiting to be checked**, with an uncertain due date and a reference
  that could not be read at all
- a letter **still being read**
- a letter that **came out too blurry**, twice
- four letters **confirmed**: one overdue, one upcoming, one **appointment with
  a time of day** (and therefore one reminder, not two), one already done with
  its remaining reminders cancelled

Two accounts: **margaret@example.com** and **operator@example.com**, both with
the password `daykeeper`, already hashed in the database. They will work as soon
as somebody builds sign-in.

You do not have to wait for sign-in to call authenticated endpoints: the seed
also plants a **development session** for Margaret and prints its cookie
(`dk_session=...`) when it runs. Set that cookie in curl, Postman or your
browser and `requireUser()` knows who you are. It only ever exists in a local
database; the seed refuses to run anywhere else.

The seeded pages have no image bytes on disk: those rows describe photographs
that were never taken.

## Commands

| | |
|---|---|
| `npm run db:reset` | rebuild the schema from `db/schema.sql`, then seed |
| `npm run db:seed` | reseed without touching the schema |
| `npm test` | the contract tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dev` | the application |
| `npm run lint` | eslint |
| `docker compose down` | stop the database |
| `docker compose down -v` | stop it and throw the data away |

## Changing the database

There are no migrations. `db/schema.sql` is the truth: edit it and run
`npm run db:reset`, which drops everything and rebuilds. Everyone's database is
therefore identical to everyone else's, always.

This works because there is no data worth keeping. It stops working the moment
there is, and `db/reset.ts` refuses to run against a non-local database so
nobody finds that out the hard way. Reasoning in
[ADR 003](architecture/adr-003-data-storage.md).

## Where things are

One rule, so you never have to open a file to find out where it may be used:
**`src/lib` is safe anywhere, `src/server` never reaches the browser.**

```
db/schema.sql             the database, and the only definition of it
db/seed.ts                Margaret's world

src/lib/contract/         the agreement. Import from here, do not restate it.
  fields.ts                 the six fields (and the optional due_time), labels, meanings
  extraction.ts             what a reader must return, and the validator
  api.ts                    the shapes the browser receives, and the upload limits
  dates.ts                  the timezone, and every date rule: today, format, parse
  reminders.ts              the one reminder-scheduling rule

src/server/               server only (password.ts and token.ts excepted: the
                          seed and the tests need them, and they are pure)
  db.ts                     query, queryOne, transaction
  env.ts                    environment variables, checked once
  auth/password.ts          hashing and verifying passwords
  auth/token.ts             making and hashing session tokens
  auth/session.ts           THE seam: createSession, getCurrentUser,
                            requireUser, destroySession. See ADR 002.
  extraction/
    provider.ts             the interface every reader implements
    mock-provider.ts        the stand-in that takes time and sometimes fails

docs/api.md               the API to build
docs/architecture/        why things are the way they are
```

## Building against this

**Read `docs/api.md` first.** It has every endpoint, every shape, and the
reasoning for the parts that look arbitrary.

**Import the types, do not restate them.** `src/lib/contract/api.ts` already
holds `DocumentSummary`, `TaskSummary`, `ExtractedFieldView` and the rest, and
they match the shapes the interface pages were written against, down to
`rawText` being camelCase and statuses using hyphens. If you find yourself
declaring a type that looks like one of those, import it instead.

**Query through `src/server/db.ts`.** It has `query`, `queryOne` and
`transaction`, and it already fixes a trap: by default the driver turns a `date`
column into a timestamp in the local zone, which can move a due date to the day
before. For a product about deadlines that is the worst available bug.

**Start every protected handler with `requireUser()`.** It answers who is
asking from the session cookie, in one place, or throws an
`UnauthenticatedError` you map to a 401. Never read the cookie or the sessions
table yourself: five hand-rolled versions of that lookup drifting apart is a
security hole, and ADR 002 exists to prevent it.

**Scope every query by user id.** There is no "get this document" that does not
also ask whose it is. A missing `WHERE user_id` is how one person ends up
reading another person's mail.

**Dates are strings, and the rules live in `src/lib/contract/dates.ts`.** On
the wire a date is `'YYYY-MM-DD'` and a time is `'HH:mm'`. Never
`new Date('2026-08-15')`: it parses as UTC midnight and shifts the day in any
zone that is not UTC. Today-in-Melbourne is `todayInZone()`, human formatting
is `formatDueDate()`, and what a person typed is `parseHumanDate()`.

**The reminder schedule has exactly one home, `planReminders()`.** The confirm
handler creates rows from it and the review screen previews the plan with it.
If you find yourself typing `[7, 1]` or `09:00`, you are creating the second
copy that lets the promise and the behaviour disagree.

Three things about the document flow that are design decisions rather than
implementation details:

**Reading takes seconds.** An upload should answer immediately with
`processing` and let the interface poll. Holding the request open until the
reader finishes gives the person a spinner instead of the ability to put the
phone down. The waiting state is part of the design, not a gap in it.

**`rawText` is not decoration.** Showing "Found on document: 15/08/26" beside a
parsed date is what turns confirming into checking. Without it, confirming is a
rubber stamp and the product's central safety claim is theatre.

**Only record corrections for fields the person actually changed.** Those
corrections are the evidence we use to measure how often the reader is wrong.

## The reader

`AI_EXTRACTION_PROVIDER=mock` is the default and needs no credentials. The mock
takes two to seven seconds, is unsure about the due date about half the time,
cannot read the reference about one time in five, and fails outright about one
document in eight on the first attempt, all deterministically by document id.

That is on purpose. A reader that always succeeded instantly would produce an
interface with no waiting state, no correction path and no failure path, and all
three of those are where this product lives.

Failures are classified by what the person can do about them: retry silently,
ask for a retake, or say plainly that we cannot read this kind of document. The
chance of failure falls away with each attempt, so a retake is a real way out
rather than a loop.

Real providers are not implemented. Reasoning in
[ADR 004](architecture/adr-004-extraction-contract.md).
