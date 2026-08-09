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

-- One attempt at reading a document.
CREATE TYPE extraction_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');

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
  -- Anything the model returned that is not one of the six contract fields.
  -- Untyped on purpose: the contract is a floor, and this is where the ceiling
  -- goes until we decide a field is worth promoting.
  open_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz,
  archived_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documents_confirmed_has_timestamp
    CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL)),
  CONSTRAINT documents_archived_has_timestamp
    CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);

CREATE INDEX documents_user_uploaded_idx ON documents (user_id, uploaded_at DESC);
CREATE INDEX documents_user_status_idx ON documents (user_id, status);
CREATE INDEX documents_user_due_idx ON documents (user_id, due_date) WHERE due_date IS NOT NULL;

-- One photographed sheet. The bytes live in object storage; this table holds
-- the path and enough metadata to show a thumbnail and to tell the person which
-- page they are looking at.
--
-- `attempt` exists because a retake uploads a fresh set of pages for the same
-- document, and the API promises that previous attempts stay in the history.
-- Without it, "replaces every page" would mean deleting the very image a
-- failed reading was judged against. The current pages of a document are the
-- rows with the highest attempt.
CREATE TABLE document_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  attempt       integer NOT NULL DEFAULT 1,
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
  attempt        integer NOT NULL,
  status         extraction_status NOT NULL DEFAULT 'queued',
  provider       text NOT NULL,      -- 'mock', 'openai', 'bedrock', ...
  model          text,               -- the exact model id, for reproducible accuracy claims
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
  CONSTRAINT extracted_fields_unique_key UNIQUE (extraction_run_id, field_key),
  CONSTRAINT extracted_fields_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT extracted_fields_correction_has_timestamp
    CHECK ((corrected_value IS NULL) = (corrected_at IS NULL))
);

CREATE INDEX extracted_fields_run_idx ON extracted_fields (extraction_run_id);

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

COMMIT;
