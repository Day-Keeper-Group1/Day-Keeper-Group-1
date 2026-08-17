-- DayKeeper database schema
--
-- This file is the single source of truth for the database. There are no
-- migrations: to change the shape of the database you edit this file and reset,
-- which drops everything and rebuilds from scratch. That is safe because the
-- project has no production data and no users outside the team. See
-- docs/architecture/adr-003-data-storage.md.
--
--   npm run db:reset     drop, recreate, seed
--
-- Plain PostgreSQL. Nothing here depends on a specific host, so the same file
-- runs against the local Docker container, a Supabase project, or any other
-- managed Postgres. Keep it that way: no vendor-specific extensions, no
-- references to an external auth schema.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enumerated vocabularies
--
-- These values are the ones the user interface already speaks, so a status
-- travels from the database to the screen without being translated on the way.
-- Add a value here and it is immediately legal everywhere; invent one anywhere
-- else and Postgres rejects it.
-- ---------------------------------------------------------------------------

-- Who someone is. Only 'user' and 'platform_operator' are implemented this
-- semester; the organisation roles are named here because the project
-- description anticipates them, and adding a value later is not free.
CREATE TYPE user_role AS ENUM ('user', 'platform_operator', 'org_admin', 'org_worker');

-- Where a document is in its life.
--   processing    a photo is in, extraction has not finished
--   needs-review  extraction finished, the person has not confirmed it yet
--   confirmed     the person checked the fields and accepted them
--   failed        extraction could not produce a usable result
--   archived      the person put it away; it stays readable
CREATE TYPE document_status AS ENUM ('processing', 'needs-review', 'confirmed', 'failed', 'archived');

-- How much we trust one extracted field.
--   confirmed   a person has accepted this value (or the model was sure and
--               the person did not change it)
--   uncertain   the model produced a value but flagged it; the person must look
--   unreadable  the model could not read it at all; the person must type it
CREATE TYPE field_status AS ENUM ('confirmed', 'uncertain', 'unreadable');

-- One attempt at any of the three jobs a model does here: dividing a batch into
-- letters, reading a letter's fields, and placing a letter against the archive.
-- All three are recorded the same way, because all three have an accuracy story
-- and none of them can be reported on without the failures.
CREATE TYPE run_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');

-- Where a batch of photographs is in its life.
--   uploaded   the files are stored, nothing has looked at them
--   grouping   a reading is dividing them into letters
--   grouped    the reading has said what every photograph is. Some may be no
--              letter at all; that is an answer, not a leftover
--   failed     the reading could not divide them; the pages are still here
CREATE TYPE batch_status AS ENUM ('uploaded', 'grouping', 'grouped', 'failed');

-- Why an attempt failed. This distinction drives what the interface offers:
-- a transient failure is retried automatically, a quality failure asks the
-- person to retake the photo, and an unsupported document is a dead end that
-- we should say plainly rather than retry forever.
CREATE TYPE extraction_failure AS ENUM ('transient', 'unreadable_image', 'unsupported_document');

-- A task's life. 'upcoming' and 'overdue' are not stored: they are derived from
-- due_date and completed_at, because a task silently becomes overdue with the
-- passage of time and nothing in the system wakes up to write that down.
CREATE TYPE task_state AS ENUM ('open', 'completed', 'dismissed');

-- What a reminder is for, and where it got to.
CREATE TYPE reminder_channel AS ENUM ('in_app', 'email');
CREATE TYPE reminder_status AS ENUM ('scheduled', 'sent', 'cancelled', 'failed');

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
  password_hash   text NOT NULL,
  role            user_role NOT NULL DEFAULT 'user',
  -- IANA zone name. The product promises "a reminder at 9 am", and 9 am is
  -- meaningless without knowing whose morning. Defaulted rather than asked
  -- for at registration; a settings screen can expose it later.
  timezone        text NOT NULL DEFAULT 'Australia/Melbourne',
  -- Deactivating a person keeps their documents intact and stops them signing
  -- in. The admin dashboard offers this; it never offers deletion.
  deactivated_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_present CHECK (btrim(email) <> ''),
  CONSTRAINT users_display_name_present CHECK (btrim(display_name) <> ''),
  CONSTRAINT users_timezone_present CHECK (btrim(timezone) <> '')
);

CREATE UNIQUE INDEX users_email_canonical_key ON users (email_canonical);

-- Sessions live in the database rather than in a signed cookie so that signing
-- out, deactivating an account, or a stolen laptop can all end a session
-- immediately. The cookie carries only the hash lookup key.
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 of the cookie value. The plaintext token never touches the database,
  -- so a database leak does not hand over live sessions.
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  user_agent    text
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Documents
--
-- A document is one piece of correspondence: one letter, one bill, one form.
-- A letter can be several sheets of paper, so the images hang off it in a
-- separate table. The unit the person thinks about is the letter, not the page.
-- ---------------------------------------------------------------------------

CREATE TABLE documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         document_status NOT NULL DEFAULT 'processing',
  -- Denormalised from the extraction so that lists and the calendar do not
  -- have to join through extracted_fields on every render. Written as soon as
  -- a reading SUCCEEDS (the "to check" list shows who a letter is from before
  -- it is confirmed), then overwritten with the person's corrections at
  -- confirm. Null until the first successful reading, which is why the
  -- browser-facing types declare them nullable: a processing or failed
  -- document genuinely has no issuer yet.
  issuer         text,
  document_type  text,
  due_date       date,
  -- Appointments happen AT a time, not just BY a date. Null for everything
  -- that only has a deadline. 24-hour local wall clock; the zone is the
  -- user's. Presence of a time is what makes a document an appointment for
  -- reminder scheduling (see src/lib/contract/reminders.ts).
  due_time       time,
  amount_text    text,          -- kept as written on the page: "$347.60", "347.60 AUD"
  reference      text,
  -- What the reading called this letter when it first divided the pile, from
  -- the letterhead alone: "AGL Energy, electricity bill". Written before the
  -- six fields exist and never overwritten, because the fields replace it on
  -- screen rather than in the row.
  --
  -- It is here so a letter has a name from the moment it has an id. Extraction
  -- takes a few seconds after the division lands, and three rows sitting in a
  -- queue saying "reading…" with nothing to tell them apart is a screen a
  -- person cannot use.
  provisional_label text,
  -- Anything the model returned that is not one of the six contract fields.
  -- Untyped on purpose: the contract is a floor, and this is where the ceiling
  -- goes until we decide a field is worth promoting.
  open_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- One to three sentences saying what this letter is about, in ordinary words.
  --
  -- This is an index, not a screen. It is the only part of a document written
  -- in the vocabulary a person would search with: every official letter says
  -- "amount due" and "please retain this for your records", so searching those
  -- words matches everything, which is the same as matching nothing. See
  -- docs/architecture/adr-006-matching-and-the-projection.md.
  --
  -- Deliberately a column and NOT a seventh contract field, so it cannot reach
  -- the review screen by accident. ADR 004 deferred `summary` because a
  -- generated sentence is a hallucination surface shown to readers least able
  -- to spot one; both halves of that reason are about showing it to somebody.
  summary        text,
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz,
  archived_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- One-way implications, not equalities. A person can archive a letter they
  -- already confirmed, and when they do, the status becomes 'archived' while
  -- confirmed_at must survive: it is the record that a human checked this
  -- letter, which is what the whole calendar's trustworthiness rests on.
  -- Written as an equality these two constraints would make archiving a
  -- confirmed document impossible without erasing that record.
  CONSTRAINT documents_confirmed_has_timestamp
    CHECK (status <> 'confirmed' OR confirmed_at IS NOT NULL),
  CONSTRAINT documents_archived_has_timestamp
    CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE INDEX documents_user_uploaded_idx ON documents (user_id, uploaded_at DESC);
CREATE INDEX documents_user_status_idx ON documents (user_id, status);
CREATE INDEX documents_user_due_idx ON documents (user_id, due_date) WHERE due_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Uploads
--
-- Every photograph enters here, and only here. A person clearing a week of post
-- takes ten pictures without pausing to say where one letter ends, or picks
-- them out of an album in whatever order they were found: one letter's pages
-- shuffled between another's, a photograph of a grandchild in the middle. A
-- batch is what actually arrives, the letters are the reading's answer, and
-- nothing between the two is assumed. That is why pages cannot be attached to
-- a document at the moment they are stored: nothing knows yet which document,
-- if any, they belong to. See
-- docs/architecture/adr-005-ingestion-and-grouping.md.
-- ---------------------------------------------------------------------------

CREATE TABLE upload_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         batch_status NOT NULL DEFAULT 'uploaded',
  -- Set when the person is deliberately re-photographing a letter they already
  -- have, so the reading does not have to work out what it already knows. Null
  -- for an ordinary upload, which is the case that has to be divided.
  target_document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
  failure_detail text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  grouped_at     timestamptz
);

CREATE INDEX upload_batches_user_idx ON upload_batches (user_id, created_at DESC);
CREATE INDEX upload_batches_pending_idx ON upload_batches (status) WHERE status IN ('uploaded', 'grouping');

-- One photograph, as it arrived. `position` is where it fell in the batch: the
-- name the manifest points at ("photograph 3"), and the only thing left to
-- show a person if the reading fails entirely. It carries NO meaning beyond
-- that. It does not say which letter a photograph belongs to, and it does not
-- say what order a letter's pages read in: a person picking photos from an
-- album destroys any convention before it exists. Which letter is the
-- reading's answer (document_pages rows), and reading order is the reading's
-- answer too (document_pages.page_number).
CREATE TABLE upload_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      uuid NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
  position      integer NOT NULL,
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  byte_size     integer NOT NULL,
  width_px      integer,
  height_px     integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT upload_pages_position_positive CHECK (position >= 1),
  CONSTRAINT upload_pages_byte_size_positive CHECK (byte_size > 0),
  CONSTRAINT upload_pages_unique_position UNIQUE (batch_id, position)
);

CREATE INDEX upload_pages_batch_idx ON upload_pages (batch_id, position);

-- One attempt at dividing a batch into letters.
--
-- The pass that looks at the images is the pass that divides them, so this run
-- also produces the page text the per-letter readings work from: a letterhead
-- is visual evidence that does not survive being flattened into text, and the
-- reading is the only thing that ever sees a page.
--
-- `raw_response` holds the manifest: which photographs form each letter, in
-- reading order, and which photographs are no letter at all. It is the only
-- record of how the division was decided, and no person is asked to confirm
-- that division, so it is also the only thing a miss rate can be measured
-- against.
CREATE TABLE grouping_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
  attempt          integer NOT NULL,
  status           run_status NOT NULL DEFAULT 'queued',
  provider         text NOT NULL,
  model            text,
  contract_version text,
  -- How many documents this run says the batch holds. Denormalised from
  -- raw_response so that "did it split it into three?" is a column and not a
  -- json path, because that question is the whole accuracy story.
  document_count   integer,
  -- And its other half: how many photographs it said were not letters at all.
  -- Whether it can tell a rates notice from a photograph of a grandchild is
  -- as much the miss rate as where it draws the boundaries.
  not_letter_count integer,
  failure_kind     extraction_failure,
  failure_detail   text,
  raw_response     jsonb,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  duration_ms      integer,
  CONSTRAINT grouping_runs_attempt_positive CHECK (attempt >= 1),
  CONSTRAINT grouping_runs_unique_attempt UNIQUE (batch_id, attempt),
  CONSTRAINT grouping_runs_failed_has_kind
    CHECK ((status = 'failed') = (failure_kind IS NOT NULL))
);

CREATE INDEX grouping_runs_batch_idx ON grouping_runs (batch_id, attempt DESC);
CREATE INDEX grouping_runs_status_idx ON grouping_runs (status) WHERE status IN ('queued', 'processing');

-- One photographed sheet, once it is known which letter it belongs to. The
-- bytes live in object storage; this table holds the path and enough metadata
-- to show a thumbnail and to tell the person which page they are looking at.
--
-- `attempt` exists because a retake uploads a fresh set of pages for the same
-- document, and the API promises that previous attempts stay in the history.
-- Without it, "replaces every page" would mean deleting the very image a
-- failed reading was judged against. The current pages of a document are the
-- rows with the highest attempt.
--
-- There is ONE attempt counter, and it belongs to extraction_runs. This column
-- records which run these pages were photographed for, so a retry (which
-- re-reads pages already on file) adds a run and no page rows, and a retake
-- writes page rows carrying the number of the run it is about to trigger. The
-- highest attempt in this table is therefore not always the highest run: after
-- retry, retry, retake the pages jump from 1 to 4, and the gap is correct.
-- Reading it the other way, as its own sequence, is how you end up unable to
-- say which images a given reading actually saw.
CREATE TABLE document_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- Which photograph this is, back in the batch it arrived in. Keeping the link
  -- rather than only the path is what lets anyone ask "which upload did this
  -- come from, and what else came with it" three months later, which is the
  -- question a wrong division raises.
  upload_page_id uuid REFERENCES upload_pages(id) ON DELETE SET NULL,
  attempt       integer NOT NULL DEFAULT 1,
  -- Where this page falls when the letter is READ: page one first. This is
  -- the manifest's answer, not the camera's. The reading can see "Page 2 of
  -- 3" printed on a sheet; the order the photographs happened to arrive in is
  -- upload_pages.position and means nothing here.
  page_number   integer NOT NULL,
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  byte_size     integer NOT NULL,
  width_px      integer,
  height_px     integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_pages_attempt_positive CHECK (attempt >= 1),
  CONSTRAINT document_pages_page_number_positive CHECK (page_number >= 1),
  CONSTRAINT document_pages_byte_size_positive CHECK (byte_size > 0),
  CONSTRAINT document_pages_unique_page UNIQUE (document_id, attempt, page_number)
);

CREATE INDEX document_pages_document_idx ON document_pages (document_id, attempt DESC, page_number);

-- ---------------------------------------------------------------------------
-- Extraction
--
-- Every attempt at reading a document is recorded, including the failures.
-- Keeping the history is what lets us report honest accuracy numbers later and
-- lets the admin dashboard show that a document failed three times before it
-- gave up.
-- ---------------------------------------------------------------------------

CREATE TABLE extraction_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- The canonical attempt counter for a document. document_pages.attempt
  -- points at this number; it does not run in parallel with it.
  attempt        integer NOT NULL,
  status         run_status NOT NULL DEFAULT 'queued',
  provider       text NOT NULL,      -- 'mock', 'openai', 'bedrock', ...
  model          text,               -- the exact model id, for reproducible accuracy claims
  -- The shape the payload was written in (CONTRACT_VERSION in
  -- src/lib/contract/extraction.ts). Stored per run rather than assumed,
  -- because the contract will change and a stored payload read back weeks
  -- later has to say which set of rules it was written under.
  contract_version text,
  failure_kind   extraction_failure,
  failure_detail text,
  -- Exactly what the provider returned, before we validated or reshaped it.
  -- When an extraction looks wrong, this is the only place that can say whether
  -- the model or our parsing was at fault.
  raw_response   jsonb,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  duration_ms    integer,
  CONSTRAINT extraction_runs_attempt_positive CHECK (attempt >= 1),
  CONSTRAINT extraction_runs_unique_attempt UNIQUE (document_id, attempt),
  CONSTRAINT extraction_runs_failed_has_kind
    CHECK ((status = 'failed') = (failure_kind IS NOT NULL))
);

CREATE INDEX extraction_runs_document_idx ON extraction_runs (document_id, attempt DESC);
CREATE INDEX extraction_runs_status_idx ON extraction_runs (status) WHERE status IN ('queued', 'processing');

-- One field of one extraction attempt.
--
-- field_key is text rather than an enum because the six contract fields are a
-- floor, not a ceiling: a provider may return more, and we would rather store
-- it than drop it. The six that must always be present are enforced in the
-- contract validator, not here.
--
-- Both what the model said and what the person typed are kept. Overwriting the
-- model's answer with the correction would destroy the only evidence of how
-- often the model is wrong.
CREATE TABLE extracted_fields (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  field_key         text NOT NULL,
  extracted_value   text,          -- what the model read; null when unreadable
  raw_text          text,          -- the snippet on the page it read it from
  status            field_status NOT NULL,
  confidence        numeric(4,3),  -- 0.000 to 1.000 when the provider reports one
  corrected_value   text,          -- what the person typed instead, if anything
  corrected_at      timestamptz,
  -- When a person saw this field flagged and accepted it without changing it.
  --
  -- The review screen promises "never from a date you haven't checked", and
  -- this column is where that promise stops being decorative: a flagged field
  -- with neither a correction nor this timestamp was never looked at. The
  -- obvious alternative, flipping `status` from 'uncertain' to 'confirmed',
  -- would erase the fact that the model was ever unsure, which is the same
  -- accuracy evidence corrected_value exists to protect.
  acknowledged_at   timestamptz,
  CONSTRAINT extracted_fields_unique_key UNIQUE (extraction_run_id, field_key),
  CONSTRAINT extracted_fields_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT extracted_fields_correction_has_timestamp
    CHECK ((corrected_value IS NULL) = (corrected_at IS NULL))
);

CREATE INDEX extracted_fields_run_idx ON extracted_fields (extraction_run_id);

-- One attempt at placing a letter against everything the person already has.
--
-- The question is whether these pages are the rest of a letter that is already
-- here. It cannot be a query written in advance: a party invitation has no
-- issuer worth matching and no reference number, and the save-the-date it
-- belongs with names a suburb where the invitation names a street. So the
-- reading searches for itself, and this table records how.
--
-- `tool_calls` is the search it actually performed, pattern by pattern, with
-- how many documents each one matched. Unlike a similarity score, that is
-- something a person can read and disagree with, which is the whole reason for
-- keeping it.
CREATE TABLE matching_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status           run_status NOT NULL DEFAULT 'queued',
  provider         text NOT NULL,
  model            text,
  -- What it concluded. Null means "this is a letter we have not seen before",
  -- which is an answer, not a failure to answer.
  matched_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  tool_calls       jsonb NOT NULL DEFAULT '[]'::jsonb,
  failure_detail   text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  duration_ms      integer,
  CONSTRAINT matching_runs_not_itself CHECK (matched_document_id <> document_id)
);

CREATE INDEX matching_runs_document_idx ON matching_runs (document_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- Tasks and reminders
-- ---------------------------------------------------------------------------

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Every task points back at the letter it came from. This is the link that
  -- makes the whole product trustworthy: three weeks later the person can ask
  -- "what said so?" and see the photograph. It is nullable only because a
  -- person may one day add a task by hand.
  document_id  uuid REFERENCES documents(id) ON DELETE SET NULL,
  title        text NOT NULL,
  issuer       text,
  due_date     date,
  -- Mirrors documents.due_time: set for appointments, null for deadlines.
  due_time     time,
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

CREATE TABLE reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  -- Reminders are rows, not a rule evaluated at read time, because each one has
  -- its own fate: it can be sent, cancelled when the task is completed early, or
  -- fail to send. A rule cannot remember any of that.
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
-- The admin dashboard promises that an operator manages accounts and watches
-- system health, and never sees letter content. This table is how that promise
-- is kept and shown: it records who did what to which record, and deliberately
-- has nowhere to put the contents of a letter.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,        -- 'user.sign_in', 'document.confirm', 'admin.deactivate_user'
  target_type text,                 -- 'document', 'user', 'task'
  target_id   uuid,
  -- Metadata only. Never field values, never letter text, never amounts.
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);

-- Every prompt sent to a model, for the course GenAI declaration and for
-- reproducing accuracy claims. Kept separate from audit_logs because it has a
-- different retention story and a different audience.
CREATE TABLE ai_prompt_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid REFERENCES extraction_runs(id) ON DELETE SET NULL,
  provider          text NOT NULL,
  model             text,
  prompt            text NOT NULL,
  prompt_tokens     integer,
  completion_tokens integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_prompt_logs_run_idx ON ai_prompt_logs (extraction_run_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
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

-- ---------------------------------------------------------------------------
-- The searchable projection
--
-- A letter being placed against the archive is searched for by the reading
-- itself, with glob, grep and read, so the archive has to look like something
-- those three operate on. This is that shape.
--
-- It is a VIEW and not a table, and that is the entire point. A copy written
-- alongside the source drifts, and a drifted search index does not fail loudly:
-- it answers "nothing matches", confidently, about a world that has moved on.
-- A view cannot drift because it is not a copy, it is the query. When a
-- sequential scan over a few hundred documents stops being immaterial, this
-- becomes a materialised view refreshed inside the confirm transaction, and
-- nothing that reads it changes.
--
-- See docs/architecture/adr-006-matching-and-the-projection.md.
-- ---------------------------------------------------------------------------

-- Words to a path segment: lower case, one hyphen between runs of anything else.
CREATE OR REPLACE FUNCTION slugify(value text) RETURNS text AS $$
  SELECT btrim(regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'), '-');
$$ LANGUAGE sql IMMUTABLE;

-- The same, after dropping a company suffix.
--
-- This is load-bearing rather than tidy. The first search anybody writes is by
-- who sent it, `glob('**/*agl-energy*')`, and the seed already contains the
-- problem: the same letter yields "AGL Energy" as its value and "AGL Energy
-- Limited" as the text it was read from. Slugged apart those are two folders,
-- that search finds half of them, and nothing announces the half it missed.
CREATE OR REPLACE FUNCTION normalise_issuer(value text) RETURNS text AS $$
  SELECT slugify(
    regexp_replace(
      coalesce(value, ''),
      '[[:space:],.]+(pty\.?[[:space:]]*)?(ltd|limited|inc|incorporated|llc|plc|pty)\.?[[:space:]]*$',
      '',
      'gi'
    )
  );
$$ LANGUAGE sql IMMUTABLE;

CREATE VIEW document_search AS
SELECT
  d.id,
  d.user_id,
  d.status,

  -- The path is the index. Two levels of directory mean a month can be
  -- filtered without reading a byte, and the file name carries the two things
  -- anybody actually searches by. The date is the DUE date: the calendar is
  -- how a person holds their own archive, and a second date axis would mean
  -- the searcher has to hold two. The upload timestamp is in the front matter
  -- below, so it stays findable by content.
  CASE WHEN d.due_date IS NULL THEN 'no-date/'
       ELSE to_char(d.due_date, 'YYYY/MM/DD-') END
    || coalesce(nullif(normalise_issuer(d.issuer), ''), 'unknown-sender')
    || '-' || coalesce(nullif(slugify(d.document_type), ''), 'unread')
    || '-' || left(d.id::text, 4) || '.md' AS path,

  -- Front matter is what gets matched exactly. The fields read as lines because
  -- that is both legible and greppable, and they use the contract's own keys
  -- rather than the screen's labels: nobody reads this, so presentation names
  -- would only be a fourth copy of FIELD_LABELS waiting to drift. Their order
  -- is alphabetical for the same reason.
  concat_ws(E'\n',
    '---',
    'id: ' || d.id::text,
    'status: ' || d.status::text,
    'uploaded: ' || to_char(d.uploaded_at AT TIME ZONE u.timezone, 'YYYY-MM-DD"T"HH24:MI'),
    'pages: ' || coalesce(pg.n, 0)::text,
    '---',
    '',
    '# ' || coalesce(d.document_type, 'Unread document')
          || coalesce(' from ' || d.issuer, ''),
    '',
    fields.lines,
    -- A heading with nothing under it is noise a search has to wade through,
    -- so each section exists only when it has content.
    CASE WHEN d.summary   IS NOT NULL THEN E'\n## What this is about\n'   || d.summary   END,
    CASE WHEN extra.lines IS NOT NULL THEN E'\n## Also on the page\n'     || extra.lines END,
    CASE WHEN fields.raw  IS NOT NULL THEN E'\n## As read from the page\n' || fields.raw END
  ) AS body

FROM documents d
JOIN users u ON u.id = d.user_id

-- The most recent reading that worked. A document that has never been read
-- successfully still appears here, with nothing under the front matter, which
-- is correct: it exists, and it matches nothing.
LEFT JOIN LATERAL (
  SELECT r.id
  FROM extraction_runs r
  WHERE r.document_id = d.id AND r.status = 'succeeded'
  ORDER BY r.attempt DESC
  LIMIT 1
) latest ON true

LEFT JOIN LATERAL (
  SELECT
    string_agg(f.field_key || ': ' ||
               coalesce(f.corrected_value, f.extracted_value, '(unreadable)'),
               E'\n' ORDER BY f.field_key) AS lines,
    string_agg(f.raw_text, E'\n' ORDER BY f.field_key)
      FILTER (WHERE f.raw_text IS NOT NULL) AS raw
  FROM extracted_fields f
  WHERE f.extraction_run_id = latest.id
) fields ON true

LEFT JOIN LATERAL (
  SELECT string_agg(k || ': ' || v, E'\n' ORDER BY k) AS lines
  FROM jsonb_each_text(d.open_payload) AS t(k, v)
) extra ON true

LEFT JOIN LATERAL (
  SELECT count(*)::int AS n
  FROM document_pages p
  WHERE p.document_id = d.id
    AND p.attempt = (SELECT max(attempt) FROM document_pages WHERE document_id = d.id)
) pg ON true;

COMMIT;
