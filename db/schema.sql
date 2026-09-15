-- DayKeeper database schema
--
-- This file is the database. There are no migration files: to change the shape
-- of the database you edit this file and run `npm run db:reset`, which drops
-- everything, rebuilds it, and reseeds.
--
-- Migrations solve the problem of changing a database you cannot drop. We can
-- drop ours. There is no production data and no user outside the team, while
-- the schema still changes several times a week and five people build against
-- it at once. A folder of ordered migration files would conflict whenever two
-- of us wrote one in the same week, and would leave teammates running subtly
-- different schemas without knowing it. Rebuilding from a single file means
-- every database is identical to every other, and the diff of a schema change
-- is the schema rather than an instruction for reaching it.
--
-- This has an expiry date. The moment anything real is stored it stops being
-- safe, and the first migration tool arrives before the first real user does.
-- db/reset.ts refuses to run against a database that is not local unless it is
-- told to in so many words.
--
-- Ten tables, spoken as plain SQL through `pg`. No ORM: the interesting part of
-- this backend is the queries, a teammate reading one should see exactly what
-- reaches the database, and an ORM would add a second definition of everything
-- below that has to be kept in step with this one by hand.
--
-- Plain PostgreSQL. No vendor-specific extension and no reference to a hosted
-- provider's auth schema, so the same file runs against the local Docker
-- container or against any managed Postgres. Keep it that way.
--
-- The photographs are not in here. These tables hold a key; the bytes are
-- objects in a bucket, reached only through src/server/storage.ts. `db:reset`
-- empties that bucket in the same breath as it drops these tables, because
-- rows and objects drifting out of step is how "it works on my machine"
-- starts.
--
-- What this release builds, and what it deliberately leaves out: docs/scope.md.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enumerated vocabularies
--
-- These values are the ones the interface already speaks, so a status travels
-- from a table to the screen without being translated on the way: hence
-- 'needs-review' rather than 'needs_review'. Field keys stay snake_case,
-- because that is what the extraction contract calls them. Add a value here and
-- it is legal everywhere at once; invent one anywhere else and Postgres rejects
-- it.
-- ---------------------------------------------------------------------------

-- Who someone is. Two kinds of account sign in this release, a person and a
-- platform operator. There is no operator dashboard in it (docs/scope.md); the
-- role stays because who someone is outlives what has been built for them, and
-- an account created without one would have to be given one retrospectively by
-- guesswork. The organisation roles are named because the project description
-- anticipates institutional customers, so the vocabulary is settled once here
-- rather than invented twice later.
CREATE TYPE user_role AS ENUM ('user', 'platform_operator', 'org_admin', 'org_worker');

-- Where a letter is in its life.
--   processing    the photographs are stored, the reading has not come back
--   needs-review  the reading came back, the person has not confirmed it yet
--   confirmed     the person looked at what was read and accepted it
--   failed        no reading could be produced at all
--   archived      the person put it away; it stays readable
--
-- 'failed' is here because a model call can fail for ordinary technical
-- reasons, and a row has to be able to say so: a letter left on 'processing'
-- forever is the same fact told as a lie. Nothing in this release offers a way
-- back out of it, which is a scope decision rather than an oversight; see
-- docs/scope.md.
CREATE TYPE document_status AS ENUM ('processing', 'needs-review', 'confirmed', 'failed', 'archived');

-- How much the reading trusts one field. What each value means, and why a value
-- the model was unsure of is stored and never shown, is in
-- src/lib/contract/extraction.ts.
CREATE TYPE field_status AS ENUM ('confirmed', 'uncertain', 'unreadable');

-- Where a reading got to.
CREATE TYPE run_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');

-- A task's life. 'upcoming' and 'overdue' are not values here, and there is no
-- column for them anywhere: a task becomes overdue because time passed, and
-- nothing in this system wakes at midnight to write that down. Both are worked
-- out while a screen is drawn, from the tick and today's date in the person's
-- zone. A stored flag would need a clock to keep it honest, and a stale flag
-- raises no error, it simply reads wrong.
--
-- 'dismissed' is written by nothing in this release. Ticking is the only thing
-- that completes a task.
CREATE TYPE task_state AS ENUM ('open', 'completed', 'dismissed');

-- What a reminder goes out over, and what became of it. There is deliberately
-- no 'cancelled'; the reminders table below says why.
CREATE TYPE reminder_channel AS ENUM ('in_app', 'email');
CREATE TYPE reminder_status AS ENUM ('scheduled', 'sent', 'skipped', 'failed');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  -- Case- and whitespace-insensitive uniqueness. Margaret will type
  -- " Margaret.W@Example.COM " and expect to be let in.
  email_canonical text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  display_name    text NOT NULL,
  -- What hashes this, and why sessions are rows rather than a signed cookie:
  -- src/server/auth/.
  password_hash   text NOT NULL,
  role            user_role NOT NULL DEFAULT 'user',
  -- IANA zone name. The product promises "a reminder at 9 am", and 9 am is
  -- meaningless without knowing whose morning. Defaulted rather than asked for
  -- at registration; a settings screen can expose it later.
  timezone        text NOT NULL DEFAULT 'Australia/Melbourne',
  -- Deactivating a person stops them signing in and leaves their letters
  -- intact. A timestamp rather than a boolean, because when it happened is
  -- worth as much as that it happened. Nothing deletes a person.
  deactivated_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_present CHECK (btrim(email) <> ''),
  CONSTRAINT users_display_name_present CHECK (btrim(display_name) <> ''),
  CONSTRAINT users_timezone_present CHECK (btrim(timezone) <> '')
);

CREATE UNIQUE INDEX users_email_canonical_key ON users (email_canonical);

-- The cookie carries a token; this row is the session itself. Keeping the
-- session here rather than inside the cookie is what lets signing out, a
-- deactivated account or a stolen laptop end one immediately. See
-- src/server/auth/.
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The hash of the cookie value, never the value. The plaintext token does not
  -- touch the database, so a database leak does not hand over live sessions.
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  user_agent    text
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Letters
--
-- A document is one piece of correspondence: one letter, one bill, one form.
-- A letter is often several sheets of paper, so the photographs hang off it in
-- document_pages. The unit a person thinks about is the letter, not the page,
-- and treating one photograph as one document would have made every task about
-- page three of a form.
--
-- One upload is one letter, and every photograph in that upload belongs to it
-- (docs/scope.md). So a page knows which letter it is part of at the moment it
-- is stored, and no step between arriving and being read has to decide.
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         document_status NOT NULL DEFAULT 'processing',
  -- Everything down to `reference` is denormalised from the reading, so that
  -- lists and the calendar do not join through extracted_fields on every
  -- render. It is written the moment a reading SUCCEEDS, because the "to check"
  -- list names who a letter is from before anybody has confirmed it, and only
  -- from CONFIDENT values: a hedged date or an unreadable reference stays NULL
  -- here, because a value the model was unsure of never reaches a document, the
  -- calendar or a screen (src/lib/contract/api.ts). The hedge itself is kept
  -- one table over, in extracted_fields.
  --
  -- Nobody edits these by hand, and they are NULL until the reading succeeds,
  -- which is why the browser-facing types declare them nullable.
  issuer         text,
  document_type  text,
  -- A calendar day, with no zone and no time in it. The rules that keep it that
  -- way on the journey to a screen are in src/lib/contract/dates.ts, and the
  -- driver is stopped from turning it into a shifted instant on the way out of
  -- here in src/server/db.ts. For a product about deadlines, a date landing on
  -- the day before is the worst bug available.
  due_date       date,
  -- Appointments happen AT a time, not just BY a date. Null for everything that
  -- only has a deadline. A 24-hour local wall clock; the zone is the user's.
  -- The presence of a time is what makes a letter an appointment when reminders
  -- are planned; see src/lib/contract/reminders.ts.
  due_time       time,
  amount_text    text,          -- kept as written on the page: "$347.60", "347.60 AUD"
  reference      text,
  -- Anything the reading returned that is not one of the six contract fields.
  -- Untyped on purpose: six is a floor rather than a ceiling
  -- (src/lib/contract/fields.ts), and this is where the ceiling goes until a
  -- field is worth promoting.
  open_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz,
  archived_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- One-way implication, not an equality. A person can archive a letter they
  -- already confirmed, and when they do the status becomes 'archived' while
  -- confirmed_at has to survive: it is the record that a human checked this
  -- letter, which is what the calendar's trustworthiness rests on. Written as
  -- an equality, these two constraints would make archiving a confirmed letter
  -- impossible without erasing that record.
  CONSTRAINT documents_confirmed_has_timestamp
    CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
  CONSTRAINT documents_archived_has_timestamp
    CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE INDEX documents_user_uploaded_idx ON documents (user_id, uploaded_at DESC);
CREATE INDEX documents_user_status_idx ON documents (user_id, status);
CREATE INDEX documents_user_due_idx ON documents (user_id, due_date) WHERE due_date IS NOT NULL;

-- One photographed sheet. The bytes live in the object store; this row holds
-- the key and enough about the image to lay out a thumbnail without fetching
-- it first.
--
-- page_number is the order the photographs were taken, and the order the
-- letters area shows them in. A person works through a form front to back
-- without being asked to, so nothing has to be decided here.
CREATE TABLE document_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number   integer NOT NULL,
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  byte_size     integer NOT NULL,
  width_px      integer,
  height_px     integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_pages_page_number_positive CHECK (page_number >= 1),
  CONSTRAINT document_pages_byte_size_positive CHECK (byte_size > 0),
  -- Also the index a letter's pages are read by, in order. Postgres builds one
  -- for the constraint, so a second index on the same two columns would only be
  -- another thing to keep updated.
  CONSTRAINT document_pages_unique_page UNIQUE (document_id, page_number)
);

-- ---------------------------------------------------------------------------
-- Extraction
--
-- A letter's photographs are read under the scheme in docs/extraction.md and
-- come back as the six fields (src/lib/contract/fields.ts). The reading is
-- recorded whether it worked or not. Keeping the failures is what makes an
-- accuracy figure honest: a table holding only the readings that worked can be
-- quoted to say anything.
--
-- KAN-63: one extraction_runs row per round of the scheme. A round is two
-- reader calls, and a judge call when they differ; each of those calls, and
-- each attempt at one, is a model_calls row under the round. A round whose
-- readings cannot be decided is closed as failed and the next round is a new
-- row, so the table says how many rounds a letter took and why each one ended.
-- The API reads a round only to find the one that succeeded; everything else
-- on it is the record of what happened, for whoever has to find out. There is
-- still no retake by the person (docs/scope.md).
--
-- The totals on a round (judged, tokens, cost, duration) are written when the
-- round closes, from its model_calls rows, so the grid answers "what did this
-- round take" without a query. document_reading_totals, below model_calls,
-- adds the rounds of a letter up.
--
-- One reading per letter all the same. The two unique indexes below the table
-- are not bookkeeping: at most one run per letter ever succeeds, which is what
-- makes a second answer to the same question arrive as an error rather than as
-- two sets of fields with nothing to say which one the tables were written
-- from; and at most one is under way at a time, so two readers can never be
-- racing over the same photographs. Every query that reads a reading asks for
-- the succeeded run and nothing else.
-- ---------------------------------------------------------------------------

CREATE TABLE extraction_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status         run_status NOT NULL DEFAULT 'queued',
  provider       text NOT NULL,      -- which implementation of the reader ran
  -- The reader's exact model id, so a figure can name what produced it. Only
  -- the reader's: whether a judge was called, and with which model, is
  -- `judged` and the round's model_calls rows.
  model          text,
  -- The shape the payload was written in (CONTRACT_VERSION in
  -- src/lib/contract/extraction.ts). Stored per run rather than assumed,
  -- because the contract will change, and a stored payload read back weeks
  -- later has to be able to say which rules it was written under.
  contract_version text,
  failure_detail text,
  -- KAN-63: the reading the round decided, as one document: the fields each
  -- taken from the readings that agreed, the numbers of both readings put
  -- together. Not any one call's answer; each call's own answer is its
  -- model_calls row. Null for a round that decided nothing.
  raw_response   jsonb,
  -- KAN-63: whether this round called the judge, because its two readings
  -- differed.
  judged         boolean NOT NULL DEFAULT false,
  -- KAN-63: every call of the round added up, failed attempts included when
  -- the model reported what they used. Output includes reasoning, as Azure
  -- reports it. Null when no call reported any (the mock).
  input_tokens   integer,
  output_tokens  integer,
  -- KAN-63: those calls at list price, in US dollars
  -- (src/server/extraction/prices.ts). An estimate, not an invoice.
  estimated_cost_usd numeric(12, 8),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  -- KAN-63: how long the round took by the clock, from its start to the moment
  -- it closed: both reader calls, the judge, every attempt and every pause
  -- between attempts.
  duration_ms    integer,
  -- A failure that does not say anything is a row nobody can act on, and a
  -- detail on a run that succeeded is a contradiction. Both directions are
  -- worth refusing.
  CONSTRAINT extraction_runs_failed_has_detail
    CHECK ((status = 'failed') = (failure_detail IS NOT NULL))
);

CREATE INDEX extraction_runs_status_idx ON extraction_runs (status) WHERE status IN ('queued', 'processing');
CREATE UNIQUE INDEX extraction_runs_one_success_per_document
  ON extraction_runs (document_id) WHERE status = 'succeeded';
CREATE UNIQUE INDEX extraction_runs_one_under_way_per_document
  ON extraction_runs (document_id) WHERE status IN ('queued', 'processing');

-- KAN-63: every model call a reading made.
--
-- A letter is read under the scheme in docs/extraction.md: two reader calls a
-- round, a judge call when they differ, and a failed call made again. The
-- extraction_runs row is the round and carries the decided reading; these rows
-- are the calls under it, one per attempt, so the table says how many calls a
-- letter took, with which model, what each one answered and what it cost.
-- slot tells the two reader calls of a round apart.
--
-- Tokens are as Azure reported them: cached_tokens is the part of
-- input_tokens served from its cache, and output_tokens includes
-- reasoning_tokens. A call that failed after the model answered (not JSON, or
-- outside the contract) was still billed, so its answer, duration, tokens and
-- cost are kept too; one that never reached the model has none of them.
CREATE TABLE model_calls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  role              text NOT NULL,
  slot              integer NOT NULL,
  attempt           integer NOT NULL,
  status            text NOT NULL,
  model             text,
  effort            text,
  -- What the model answered. For a call that succeeded, the reading as the
  -- contract validator passed it. For a call whose answer was refused, the
  -- answer as it came: the JSON when it was JSON outside the contract (the
  -- failure_detail names where), the text as a JSON string when it was not
  -- JSON. Null only for a call that never reached the model.
  raw_response      jsonb,
  failure_detail    text,
  input_tokens      integer,
  cached_tokens     integer,
  reasoning_tokens  integer,
  output_tokens     integer,
  -- At list price, in US dollars (src/server/extraction/prices.ts).
  estimated_cost_usd numeric(12, 8),
  duration_ms       integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_calls_role CHECK (role IN ('reader', 'judge')),
  CONSTRAINT model_calls_status CHECK (status IN ('succeeded', 'failed')),
  CONSTRAINT model_calls_failed_has_detail
    CHECK ((status = 'failed') = (failure_detail IS NOT NULL))
);

CREATE INDEX model_calls_run_idx ON model_calls (extraction_run_id);

-- KAN-63: what reading each letter took, every round added up, one row a
-- letter.
--
-- A view rather than columns on documents, for two reasons. It is worked out
-- from the rounds each time it is read, so it cannot disagree with them, and
-- no code has to remember to keep it up to date on every way a reading can
-- end. And documents is what the API and the screens read; these figures are
-- for whoever is looking into what a reading cost, and live beside the tables
-- they come from rather than among the columns a person is shown.
--
-- duration_ms runs from the first round's start to the last round's close.
-- A letter still being read has no close yet, so its duration is null.
CREATE VIEW document_reading_totals AS
SELECT d.id                                          AS document_id,
       d.issuer,
       d.status,
       d.uploaded_at,
       count(r.id)::integer                          AS rounds,
       (count(*) FILTER (WHERE r.judged))::integer   AS judged_rounds,
       sum(r.input_tokens)::integer                  AS input_tokens,
       sum(r.output_tokens)::integer                 AS output_tokens,
       sum(r.estimated_cost_usd)                     AS estimated_cost_usd,
       CASE WHEN bool_and(r.finished_at IS NOT NULL)
            THEN (extract(epoch FROM max(r.finished_at) - min(r.started_at)) * 1000)::integer
       END                                           AS duration_ms
  FROM documents d
  JOIN extraction_runs r ON r.document_id = d.id
 GROUP BY d.id;

-- One field of one reading.
--
-- field_key is text rather than an enum because the six contract fields are a
-- floor and not a ceiling: a provider may return more, and storing it costs
-- less than deciding in advance to throw it away. That all six are present is
-- enforced by the contract validator, not here.
--
-- 'uncertain' rows keep their extracted_value even though no screen ever shows
-- it; the reason is in src/lib/contract/extraction.ts. There are no correction
-- columns, because nobody edits a reading (src/lib/contract/api.ts).
CREATE TABLE extracted_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  field_key         text NOT NULL,
  extracted_value   text,          -- what the model read; null when unreadable
  status            field_status NOT NULL,
  confidence        numeric(4,3),  -- 0.000 to 1.000 when the provider reports one
  CONSTRAINT extracted_fields_unique_key UNIQUE (extraction_run_id, field_key),
  CONSTRAINT extracted_fields_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX extracted_fields_run_idx ON extracted_fields (extraction_run_id);

-- KAN-58: every identifier one reading found printed on the letter.
--
-- A letter prints several numbers a person could be asked for, and
-- extracted_fields keeps only the one in `reference`. These rows keep the rest,
-- each under the label the page printed beside it, in the order the reader
-- gave them. There is no 'unreadable' row: a number that could not be read is
-- not in the list. 'uncertain' rows are stored and never shown, the same rule
-- as for fields (src/lib/contract/extraction.ts).
CREATE TABLE extracted_identifiers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  position          integer NOT NULL,
  label             text NOT NULL,
  value             text NOT NULL,
  status            field_status NOT NULL,
  CONSTRAINT extracted_identifiers_unique_position UNIQUE (extraction_run_id, position),
  CONSTRAINT extracted_identifiers_status CHECK (status IN ('confirmed', 'uncertain'))
);

CREATE INDEX extracted_identifiers_run_idx ON extracted_identifiers (extraction_run_id);

-- ---------------------------------------------------------------------------
-- Tasks and reminders
-- ---------------------------------------------------------------------------

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Every task points back at the letter it came from. This is the link that
  -- makes the whole product trustworthy: weeks later the person can ask "what
  -- said so?" and be shown the photograph. Nullable only because a person may
  -- one day add a task by hand.
  document_id  uuid REFERENCES documents(id) ON DELETE SET NULL,
  title        text NOT NULL,
  issuer       text,
  due_date     date,
  -- Mirrors documents.due_time: set for an appointment, null for a deadline.
  due_time     time,
  -- The one fact about a task that a person controls. Ticked is completed, not
  -- ticked is open, and everything else a screen says (upcoming, overdue, where
  -- the row sorts) is arithmetic done while drawing. Ticking is never locked in
  -- either direction: untick a task whose date has passed and it is overdue
  -- again by arithmetic, not by a transition anything had to run and could get
  -- wrong.
  state        task_state NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_title_present CHECK (btrim(title) <> ''),
  CONSTRAINT tasks_completed_has_timestamp
    CHECK ((state = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX tasks_user_state_due_idx ON tasks (user_id, state, due_date);
CREATE INDEX tasks_document_idx ON tasks (document_id) WHERE document_id IS NOT NULL;

-- A reminder is a clock, and the clock checks the tick when it rings.
--
-- Ticking a task writes nothing here, and unticking writes nothing here. When a
-- row's moment arrives, the dispatcher reads the task at that moment: still
-- open means send and write 'sent', already done means send nothing and write
-- 'skipped'. That is the product's only judgement about whether to nag, it is
-- made at the only moment that matters, and it is made in the one place that
-- sends.
--
-- The design this replaced flipped the waiting rows to 'cancelled' when a task
-- was ticked and revived them when it was unticked, except the ones whose time
-- had already passed. None of it was wrong. All of it was a second copy of "the
-- task is done", and a copy needs a transaction to keep it honest and an undo
-- rule to unwind it; that undo rule had grown its exception within a week of
-- being written. Storing the fact once and reading it at the moment of use
-- needs no undo rule, because there is nothing to undo. A person can tick at
-- breakfast, untick at lunch and tick again at dinner, and none of her wavering
-- is written down anywhere.
--
-- Rows rather than a rule evaluated at read time, because each one has its own
-- fate to record, and a rule cannot remember what it did. When they are planned
-- and how far ahead: src/lib/contract/reminders.ts.
CREATE TABLE reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  channel      reminder_channel NOT NULL DEFAULT 'in_app',
  status       reminder_status NOT NULL DEFAULT 'scheduled',
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminders_sent_has_timestamp
    CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);

CREATE INDEX reminders_due_idx ON reminders (scheduled_for) WHERE status = 'scheduled';
CREATE INDEX reminders_task_idx ON reminders (task_id);

-- ---------------------------------------------------------------------------
-- Audit
--
-- What happened to which record, and who did it. Signing in, confirming a
-- letter and deactivating an account are the events worth being able to
-- reconstruct after the fact, when the only other account of them is somebody's
-- memory.
--
-- The table has nowhere to put the contents of a letter, and that is the point
-- rather than an omission. An operator can be given everything in here and
-- still never read a word of anyone's post.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,        -- 'user.sign_in', 'document.confirm', 'user.deactivate'
  target_type text,                 -- 'document', 'user', 'task'
  target_id   uuid,
  -- Metadata only. Never field values, never letter text, never amounts.
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
--
-- A trigger rather than a habit. Three tables carry updated_at, and every
-- query that forgets to set it leaves a row claiming it has not changed since
-- the day it was made.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER documents_touch BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tasks_touch     BEFORE UPDATE ON tasks     FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
