# AGENTS.md · src/server/db

Everything that knows about PostgreSQL is in this folder, and it is the only folder under `src/` that imports Drizzle (`drizzle-orm` 0.45.3, over the `pg` pool). The rest of the app calls the functions in [`queries/`](queries/) and writes no SQL. If you have a branch written against `query()`, `queryOne()` and `transaction()`, this file is the walkthrough for porting it: the rules first, then the last section.

## What is where

```
src/server/db/
  index.ts          db(), the app's one handle: what a statement is run with. Server-only.
  client.ts         how a pool and the handle over it are made, and the type Db. Script-safe.
  errors.ts         dbCause() and isUniqueViolation(): reading what a failed statement threw. Script-safe.
  sql.ts            the nine named SQL expressions the builder cannot say. Server-only.
  schema/           the database, and the only definition of it. Script-safe.
    index.ts          the barrel, and the file drizzle.config.ts points at
    columns.ts        timeOfDay and updatedAt(), the two column shapes several tables share
    enums.ts          the five PostgreSQL enums, what each value means, and quotedList() for the body of a CHECK ... IN (...)
    users.ts          users, sessions
    documents.ts      documents, document_pages
    readings.ts       extraction_runs, model_calls, extracted_fields, extracted_identifiers, and the view
    tasks.ts          tasks, reminders
    audit.ts          audit_logs
  queries/          every statement the app runs, one file per schema file, named like it. Server-only.
    users.ts, documents.ts, readings.ts, tasks.ts, audit.ts
```

**Script-safe** means the file imports no `server-only`, nothing from `src/server/env.ts`, and not `index.ts`. `drizzle-kit`, the scripts in `db/` and Vitest load `schema/`, `client.ts` and `errors.ts` outside Next.js, where `server-only` throws. So `client.ts` is handed the connection string by whoever calls it. The one thing it reads from the environment is how far to trust the certificate of a database that is not local: `DATABASE_CA_CERT` and `DATABASE_SSL_NO_VERIFY`, in [`src/lib/database-tls.ts`](../../lib/database-tls.ts).

There are three folders named db. This one, `src/server/db/`, is what the app imports. [`db/`](../../../db/) is what you run from a terminal: `reset.ts`, `migrate.ts`, `seed.ts`, their helpers in `db/lib/`, and the generated migrations. [`tests/db/`](../../../tests/db/) is the tests that need PostgreSQL. One rule tells the first two apart: if the app imports it, it lives here; if you run it from a terminal, it lives under `db/`.

## Words

One word per thing, in comments and in prose.

- A **letter** is one `documents` row. The tables say document; prose says letter.
- A **reading** is what the scheme decided about a letter. `readings.ts` is the family of four tables behind it.
- A **round** is one `extraction_runs` row. The schema (`extraction_runs`, `extraction_run_id`, `runStatus`) and older comments say run for the same thing.
- A **call** is one `model_calls` row.

## Rules

Lint ([`eslint.config.mjs`](../../../eslint.config.mjs)) checks the ones a linter can see, and its message says where the thing belongs instead.

1. **A query function takes the handle first.** `(db: Db, ...)`, with no default, and `Db` comes from `../client`. The service passes `db()`, or the `tx` of its transaction, so one function serves both. A queries file therefore never needs the app's own handle, and it does not import `../index`.
2. **A function that touches a person's rows is named `Owned` and filters by the owner.** `userId` is its second parameter, and the statement carries `ownedDocument(userId)` or `ownedTask(userId)`, whatever its caller already checked. Knowing an id must never be enough to read a row, and a statement that trusted an earlier one to have asked stops being safe the day somebody calls it first. The queries files export three other kinds of function, and [`tests/db/ownership.test.ts`](../../../tests/db/ownership.test.ts) lists every function they export under exactly one of the four. An insert that makes a new row and writes its owner onto it (`insertUser`, `insertSession`, `insertDocument`, `insertTask`, `insertAuditLog`) reads no row that is already there, so it has no owner to filter by: the person is what it is handed. A statement that neither filters by the owner nor writes one is unscoped deliberately, and has a comment starting `Unscoped on purpose:` with the reason. Some of these read or change rows that are already there (`findConfirmedAction`, `closeRoundAsFailed`), and some make new rows that carry no owner of their own, under a parent row (`insertPages`, `insertModelCall`). And `ownedDocument` is not a statement but the owner filter itself, exported because the statements in `queries/readings.ts` carry it too; the test lists it as a predicate.

   The two layers order their parameters differently, so read a signature before handing it two ids. A query function takes `db` first, `userId` second and the id of the thing after it: `findOwnedTaskRows(db, userId, taskId)`. A service that opens a thing which is already there takes the id of the thing first and the person after it: `getTask(taskId, userId, ...)`, `getPageStoragePath(documentId, pageNumber, userId)`. The two services that make a letter from an id take the person first: `checkStoredUpload(userId, documentId, ...)` and `createStoredDocument(userId, timeZone, documentId, ...)`. Both ids are strings, so the compiler cannot catch a swap. The tests do: with the two swapped the owner finds nothing of her own, and `tests/db/ownership.test.ts` asks every owner-scoped statement as its owner as well as a stranger.

   What the rest of a name says: `find` answers one thing or null, and `list` answers any number of things, an empty list when there are none. A name with `Row` or `Rows` in it answers rows as the statement selected them, which the service still turns into the shape the browser receives. A name without it promises no shape: its comment and its return type say what it answers. `findOwnedTaskRows`, `completeOwnedTaskRows` and `reopenOwnedTaskRows` are the three that answer several rows for one thing: one task is one row per reminder, and no rows when the task is not there.
3. **The service that owns the rule opens the transaction, and every statement inside goes through `tx`.** `await db().transaction(async (tx) => { ... })`, each step a query function handed `tx`. Query functions never open one. This is not style: on Netlify the pool holds one connection, so a statement sent to `db()` inside a transaction waits for the connection the transaction is holding, and fails when the connect timeout runs out.
4. **SQL text has two homes: `sql.ts` and `schema/`.** What the builder cannot say becomes a named helper in `sql.ts`, with the reason beside it, and the queries file imports the name. Every piece of hand-written SQL is then in one file a reviewer can read from top to bottom, with every value bound.
5. **A statement is sent as the builder builds it, never through `.prepare()`.** Drizzle names a statement only when it is prepared, and the Supabase transaction pooler the deployed app connects through has no named prepared statements.
6. **A jsonb column is given the value itself.** Handed an object, it stores an object. Handed `JSON.stringify(object)`, it stores a JSON string with that text inside, and `jsonb_typeof` answers `string`. The one exception is `jsonbValue()` in `sql.ts`, for the one column where JSON `null` and SQL NULL mean different things.
7. **A caught database error is logged as `dbCause(error)`.** A failed statement throws `DrizzleQueryError`, and its message quotes the statement with every value bound to it: a password hash, the contents of a letter. `dbCause()` hands back the driver's own error, which carries the SQLSTATE (`isUniqueViolation()` reads it there; `error.code` on the wrapper is undefined) and leaves that list behind. It is safe on any caught error, and hands back anything that is not Drizzle's wrapper as it is, so a `catch` that may also hold an error from storage or from the reader applies it all the same. No lint rule can see this one, so it rests on whoever writes the `catch`.
8. **`updated_at` is written by the builder.** `updatedAt()` in `schema/columns.ts` makes every UPDATE sent through the builder set the column to the database's `now()`. No trigger does it, so a statement sent any other way leaves a row claiming it never changed. Write every UPDATE with the builder and leave the column out of `.set()`; `tests/db/updated-at.test.ts` holds every writer in the app to it.
9. **A list goes in as one INSERT, and an empty list returns first.** `insertPages`, `insertFields`, `insertIdentifiers` and `insertReminders` each send one statement for all their rows and start with `if (rows.length === 0) return;`, because `insert().values([])` throws and a letter can have no identifiers and no reminders.

## Traps found by running 0.45.3

Each of these was run. Each one either answers wrongly without an error, or fails a long way from its cause.

- **In a select from one table, a column placed directly in a `sql` template renders without its table name.** `` sql`(select count(*) from ${modelCalls} where ${modelCalls.extractionRunId} = ${extractionRuns.id})` `` in a select from `extraction_runs` renders `where "extraction_run_id" = "id"`. Inside the subquery PostgreSQL reads both names as columns of `model_calls`, so the subquery no longer looks at the outer row and counts nothing, without an error. Put the predicate inside `eq()`, which renders both table names, or use `db.$count`.
- **`db.$count()` cannot read from an aliased table.** It renders the alias as if it were a table (`from "every_round"`), and PostgreSQL answers that the relation does not exist. To count the rows of a table under a second name, hand a builder count to `scalar()`, as `listOwnedStoppedRounds` does.
- **`.desc()` in an index means `NULLS LAST`.** drizzle-kit writes `DESC NULLS LAST`, where PostgreSQL's own `DESC` means `NULLS FIRST`. An index that is plain `DESC` in the database is declared `.desc().nullsFirst()`.
- **`insert().select()` wants every column of the table, in the table's order.** Given fewer it throws "Insert select error: selected fields are not the same or are in a different order compared to the table definition". To copy a few columns of one row into a new one, read them with `.returning()` and pass them to `insert().values()`: `closeRoundAsFailed` reads them, and `queueRoundAfter` hands them to `insertQueuedRound`.
- **A bare `time` column reads as `HH:MM:SS`.** What the browser receives is `HH:MM`. Declare the column with `timeOfDay` from `schema/columns.ts`, which cuts it wherever it is read, through `.returning()` and through a CTE as well.
- **`insert().values([])` throws** "values() must be called with at least one value". Rule 9 is the way round it.

## How the database changes

The schema files are the only definition of the database. The migrations under [`db/migrations/`](../../../db/migrations/) are generated from them and are never written or edited by hand.

1. **Edit a schema file, and name everything.** Every column's database name is written out (`text("display_name")`), and every foreign key, unique constraint, check and index carries its name. One left unnamed gets a name Drizzle chooses, and a name that changes later is a migration that renames a constraint and does nothing else.
2. **`npm run db:generate -- --name=<what_changed>`.** It compares the schema files with the newest snapshot and writes the next migration. It needs no database. For a rename, run it in a real terminal: drizzle-kit asks whether the thing was renamed or dropped and made again, and in an agent's shell there is nobody to answer.
3. **`npm run db:migrate`.** It applies the migrations your database has not had yet and keeps your data. `npm run db:reset` is the clean start: it drops everything and applies every migration from the first.
4. **Commit the schema file and the three generated files together:** the new `.sql`, its snapshot under `meta/`, and `meta/_journal.json`. `npm run db:check` answers whether the schema files and the newest migration agree, and it runs with the tests.

The migrator (`db/migrate.ts`) records what it applied in `drizzle.__drizzle_migrations`, and applies every migration in the journal that is newer than the last one recorded there. It compares no hashes, runs everything pending in one transaction, and takes no lock. Three rules follow.

- **A merged migration stays as it was merged.** The migrator would not notice an edit or a deletion: the databases that already applied it keep the old shape, new ones get the new shape, and nothing reports the difference. To change the database again, change the schema file and generate the next migration.
- **When main gains a migration while yours is unmerged, generate yours again.** Delete your generated files, merge main, then run `db:generate`. `_journal.json` is never merged by hand: a migration whose journal entry is older than one a database has already applied is skipped on that database, silently.
- **`db:migrate` runs from one place at a time.** With no lock, two runs that start together both see the same pending migrations and both try to apply them.

## A new module, with email as the worked example

1. **The tables:** `schema/email.ts`, written like the files beside it.
2. **The barrel:** one line in `schema/index.ts`, `export * from "./email";`.
3. **The migration:** `npm run db:generate -- --name=add_email`, committed with the two files above.
4. **The statements:** `queries/email.ts`, one function per statement, under the rules above. A statement goes in the file of the table it writes, or of the first table it reads.
5. **The inventory:** [`tests/db/ownership.test.ts`](../../../tests/db/ownership.test.ts). Add the new file to `QUERIES` at the foot of that test, which is the list of queries modules it reads, and add each function the file exports to exactly one of its lists: `STATEMENTS` for one named `Owned`, with how a stranger asks it, `WRITES_THE_OWNER`, `UNSCOPED_ON_PURPOSE`, or `PREDICATES` for an owner filter the file exports. A file that is not in `QUERIES` is outside the check, and nothing says so.
6. **The rules, and turning a row into what the browser receives:** the service, `src/server/email/`. Services call query functions; routes and pages call services.
7. **The tests:** `tests/db/email.test.ts`, with fixtures in `tests/db/support/world.ts`. They run the real functions against a real PostgreSQL and look at what ended up in the tables: `npm run test:db -- tests/db/email.test.ts`.

A new query in a file that is already there is steps 4 and 5 without the new file: write the function, then add its name to one of the lists in `tests/db/ownership.test.ts`. Until it is in one, that test fails and names it.

A statement that reads another family's table together with yours goes in the file of the table it starts from. The email a letter came from, shown in the letter list, starts from `documents`, so it is a function in `queries/documents.ts`.

## Porting a branch written against query(), queryOne() and transaction()

This section can be deleted once no such branch is left.

Those three helpers are gone, and each call to one becomes a call to a function in `queries/`.

- `query(text, params)` becomes a function in `queries/<family>.ts` that says the same statement with the builder and returns its rows.
- `queryOne(text, params)` becomes the same, ending `return rows[0] ?? null;`.
- `transaction(async (client) => { ... })` becomes `db().transaction(async (tx) => { ... })` in the service, and each `client.query(...)` inside becomes a query function handed `tx` (rule 3).
- A hand-written row type goes. The queries file exports `type DocumentRow = Awaited<ReturnType<typeof listOwnedDocumentRows>>[number]` and the service takes it with `import type`. Rows arrive with camelCase keys, a `date` as `'YYYY-MM-DD'`, a `timeOfDay` as `'HH:MM'`, an instant as a `Date` and a count as a number, so the `to_char(...)` and `count(*)::integer` of the old SQL have nothing to become.
- `error.code === "23505"` becomes `isUniqueViolation(error)` (rule 7).
- A test that compared SQL text becomes a test under `tests/db/` that runs the function and looks at the tables.
