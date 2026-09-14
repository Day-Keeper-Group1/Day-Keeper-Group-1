# Start here

What this branch gives you, and what is yours to build. [`scope.md`](scope.md)
says what this release builds and what it leaves out; this page says how to run
it and where everything is.

## What is here

Three things, and deliberately only three:

1. **A database and a bucket** everyone can run in one command: a schema that is
   already settled, seed data covering every state the interface has to draw,
   and somewhere for the photographs themselves to live that behaves like the
   real thing because it speaks the same protocol.
2. **The contract**: the six fields, in TypeScript, with a validator. This is the
   agreement between whoever reads a document and whoever turns it into a task,
   and it is the one thing that has to be settled before two people can work in
   parallel.
3. **A mock reader** that behaves like a real one will, so the whole flow can be
   built and demonstrated before anyone has model access.

**The API and the pages follow `docs/api.md`.** Sign in, the letters
(upload, list, open, page images, home) and the tasks endpoints exist and the
screens read them; confirming a letter is the next piece. When you add an
endpoint, add it to that file first: it is the specification, with the
reasoning for the parts that look arbitrary.

## Running it

You need Node 20.17 or newer, npm 11 or newer, and Docker Desktop.

```bash
npm ci                    # exactly what package-lock.json says
cp .env.example .env.local
docker compose up -d      # Postgres on 55432, MinIO on 59020, viewers on 8080 and 59021
docker compose ps         # wait until db says "healthy", usually a few seconds
npm run db:reset          # build the schema, make the bucket, seed both
npm test                  # the contract tests
```

On Windows, run these in PowerShell or Git Bash. In `cmd.exe` there is no `cp`;
use `copy .env.example .env.local`.

The database viewer is at http://localhost:8080. Server `db`, user, password and
database are all `daykeeper`. That is the quickest way to see what the seed put
in the tables.

The storage viewer is at http://localhost:59021, user and password `daykeeper`
and `daykeeper_local_dev`. Photographs land in the `daykeeper` bucket, the
seeded ones included, and this is where to look when you want to know whether
an upload really stored anything.

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
55432 rather than 5432 for the same reason, and storage on 59020 and 59021
rather than 9000 and 9001, so those rarely collide.

**`npm run db:reset` says it cannot reach storage.** The MinIO container is not
running. `docker compose up -d` starts it along with everything else; it is the
service called `storage`.

### What the seed gives you

Margaret's world at the moment she opens the app, with every settled state the
interface has to draw already present, so you never have to manufacture one.
The only state not seeded is a letter still being read: a seeded row would never
finish, and photographing any letter shows the real thing for ten seconds.

- a letter **waiting to be checked**, where the reader was unsure of the due
  date and could not read the reference at all
- letters **confirmed**: one overdue, one upcoming, one **appointment with a
  time of day** (and therefore a shorter reminder ladder, see
  `src/lib/contract/reminders.ts`), and one already done, ticked off before its
  last reminder's morning, so that reminder rang, found it done, and was
  recorded `skipped`

`db/seed.ts` is the inventory: what it prints when it runs is the list.

Two accounts: **margaret@example.com** and **operator@example.com**, both with
the password `daykeeper`, already hashed in the database. They will work as soon
as somebody builds sign-in.

You do not have to wait for sign-in to call authenticated endpoints: the seed
also plants a **development session** for Margaret and prints its cookie
(`dk_session=...`) when it runs. Set that cookie in curl, Postman or your
browser and `requireUser()` knows who you are. It only ever exists in a local
database; the seed refuses to run anywhere else.

Every seeded page has a real photograph behind it. The seed uploads them as it
writes the rows, borrowing the synthetic letters in `data/synthetic-letters`
(Git LFS, so run `git lfs pull` if yours are small text files) and picking for
each letter the fixture closest to what its fields say it is. So the letters
render on a machine that has never uploaded anything, which is what showing the
product needs, and every `document_pages.storage_path` names an object that is
really there.

## Commands

| | |
|---|---|
| `npm run db:reset` | rebuild the schema from `db/schema.sql`, empty the bucket, then seed both. In that order: the seed writes photographs, so emptying afterwards would delete them |
| `npm run db:seed` | reseed without touching the schema |
| `npm run storage:reset` | make the bucket exist and empty it, without touching the database. The seeded photographs go with it; `npm run db:reset` puts both sides back |
| `npm test` | the contract tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dev` | the application |
| `npm run lint` | eslint |
| `npm run format` | prettier over the whole repository |
| `npm run worktree:setup` | give a fresh git worktree its own database, bucket and port |
| `npm run worktree:teardown` | retire them again (safe: refuses to touch the main DB) |
| `docker compose down` | stop the database |
| `docker compose down -v` | stop it and throw the data away |

Working in parallel worktrees? The runbook lives in `AGENTS.md`, section
"Worktrees: parallel agents without collisions".

Building a screen? Read [`theme.md`](theme.md) first. The palette is already
wired into `src/app/globals.css`, so shadcn components come out on-theme; what
the doc gives you is which colour means what, and the rules that are not
negotiable.

### Git hooks

`npm ci` installs them; there is nothing to set up. On commit, the staged files
are formatted (Prettier, default style, config in `.prettierrc`) and linted,
and the commit message is checked against the no-AI-attribution convention. On
push, the whole project is type-checked. So the things CI would bounce a pull
request for are caught in seconds, locally, before they cost a round trip.

`--no-verify` skips a hook in an emergency; CI still runs the same checks, so
skipping changes when a problem is found, not whether. The prototypes and the
markdown files are deliberately not formatted (`.prettierignore`): prose and
hand-built artefacts keep their hand-set shape.

## Changing the database

There are no migrations. `db/schema.sql` is the truth: edit it and run
`npm run db:reset`, which drops everything and rebuilds. Everyone's database is
therefore identical to everyone else's, always.

This works because there is no data worth keeping. It stops working the moment
there is, and `db/reset.ts` refuses to run against a non-local database so
nobody finds that out the hard way. The rest of the reasoning is at the top of
`db/schema.sql`.

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
  storage.ts                the photographs themselves: put, signed link, delete
  env.ts                    environment variables, checked once
  auth/password.ts          hashing and verifying passwords
  auth/token.ts             making and hashing session tokens
  auth/session.ts           THE seam: createSession, getCurrentUser,
                            requireUser, destroySession
  extraction/
    provider.ts             the interface every reader implements
    mock-provider.ts        the stand-in that takes time and is sometimes unsure

docs/scope.md             what this release builds, and what it does not
docs/api.md               the API to build
```

Why a thing is the way it is sits beside the thing itself, in a comment at the
top of the file that implements it.

## Building against this

**Read `docs/api.md` first.** It has every endpoint, every shape, and the
reasoning for the parts that look arbitrary.

**Import the types, do not restate them.** `src/lib/contract/api.ts` already
holds `DocumentSummary`, `TaskSummary`, `ExtractedFieldView` and the rest, and
they match the shapes the interface pages were written against, down to
statuses using hyphens. If you find yourself declaring a type that looks like
one of those, import it instead.

**Query through `src/server/db.ts`.** It has `query`, `queryOne` and
`transaction`, and it already fixes a trap: by default the driver turns a `date`
column into a timestamp in the local zone, which can move a due date to the day
before. For a product about deadlines that is the worst available bug.

**Photographs go through `src/server/storage.ts`, never through the file
system.** It stores an object, hands out a time-limited link and deletes. The
bytes are in a bucket, which is MinIO on your machine and a real bucket
wherever this ends up deployed, and both speak the same protocol so nothing has
to change. A handler that writes a file to disk works locally and loses every
photograph the first time the app is redeployed.

**Start every protected handler with `requireUser()`.** It answers who is
asking from the session cookie, in one place, or throws an
`UnauthenticatedError` you map to a 401. Never read the cookie or the sessions
table yourself: five hand-rolled versions of that lookup drifting apart is a
security hole, and the seam in `src/server/auth/session.ts` exists to prevent
it.

**Scope every query by user id.** There is no "get this document" that does not
also ask whose it is. A missing `WHERE user_id` is how one person ends up
reading another person's mail.

**Dates are strings, and the rules live in `src/lib/contract/dates.ts`.** On
the wire a date is `'YYYY-MM-DD'` and a time is `'HH:mm'`. Never
`new Date('2026-08-15')`: it parses as UTC midnight and shifts the day in any
zone that is not UTC. Today-in-Melbourne is `todayInZone()` and human
formatting is `formatDueDate()`.

**The reminder schedule has exactly one home, `planReminders()`.** The confirm
handler creates rows from it and the review screen previews the plan with it.
If you find yourself typing an offset in days, or the hour they go out, you are
creating the second copy that lets the promise and the behaviour disagree.

Two things about the document flow that are design decisions rather than
implementation details:

**Reading takes seconds.** An upload should answer immediately with
`processing` and let the interface poll. Holding the request open until the
reader finishes gives the person a spinner instead of the ability to put the
phone down. The waiting state is part of the design, not a gap in it.

**The review screen shows, it never asks.** Nothing on it is editable and
nothing on it is a question, and a value the reader was unsure of never reaches
the browser. The rule, and why there is no correction anywhere in the product,
are in `src/lib/contract/api.ts`. Do not add a field for a person to fix.

## The reader

`AI_EXTRACTION_PROVIDER=mock` is the default and needs no credentials. The mock
takes time, is sometimes unsure of a value, and sometimes cannot read one at
all, deterministically by document id, so a test can assert on it and a
demonstration does not surprise anyone. The numbers behind that behaviour live
in `src/server/extraction/mock-provider.ts`, and only there.

It behaves that way on purpose. A reader that always succeeded instantly would
produce an interface with no waiting state and nothing ever missing from a
card, and both of those are states the product has to draw.

Real providers are not implemented. `src/server/extraction/provider.ts` is the
interface each one implements, and says why the seam is there.
