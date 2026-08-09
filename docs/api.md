# API specification

**None of this is built yet. This is the shape to build.**

It is written down first because the interface, the reader and the database were
being designed by different people at the same time, and the only way that ends
in something that fits together is to settle the seams before the parts.

Every endpoint answers JSON except the one that serves an image.

The types are already in `src/lib/contract/api.ts`: `DocumentSummary`,
`DocumentDetail`, `TaskSummary`, `TaskDetail`, `ReminderView`, `HomePayload`,
`ExtractedFieldView`, `SessionUser`, `ApiError`. **Import them rather than
restating them.** They match what the interface needs, so a handler that
returns one of these needs no translation on the way to the screen.

This specification was written after building the whole thing once as a spike
and throwing it away, then checked line by line against the product prototype
(`docs/prototype/user/daykeeper-sketch-live.html`), which is the UX authority.
Where this document says "default decision", the rule was chosen to unblock
building and is explicitly open to challenge in review; the default stands
until someone argues it down.

## How to talk to it

Authentication is a `dk_session` cookie, set by sign-in and sent automatically
by the browser. Everything except the auth endpoints answers `401` without it.

Inside a handler, who-is-asking is answered by exactly one function:
`requireUser()` from `src/server/auth/session.ts` (see ADR 002). The seed
plants a development session so you can call protected endpoints before
sign-in exists; `npm run db:seed` prints the cookie to use.

**Wire formats, stated once.** A date is `'YYYY-MM-DD'`: a calendar day, never
a timestamp, never a zone. A time of day is `'HH:mm'`, 24-hour. An instant is
ISO 8601 with a zone. `src/lib/contract/dates.ts` has the helpers that keep it
that way, and `users.timezone` (an IANA name, defaulted to
`Australia/Melbourne`) says whose morning "9 am" means. Never construct
`new Date('YYYY-MM-DD')` from a wire date: it parses as UTC midnight and
shifts the day.

Errors always look like this, and `message` is written to be shown to a person
as-is:

```json
{ "error": { "code": "invalid_request", "message": "Please attach at least one photo.", "fields": { "email": "..." } } }
```

| code | status | when |
|---|---|---|
| `unauthenticated` | 401 | not signed in, or the wrong password |
| `forbidden` | 403 | signed in, but not allowed (a deactivated account) |
| `not_found` | 404 | no such thing, **or it belongs to someone else** |
| `invalid_request` | 400 | the request was malformed; `fields` says where |
| `conflict` | 409 | the thing is not in a state where this makes sense |
| `server_error` | 500 | our fault |

A document belonging to another person answers `404`, never `403`. A `403` would
confirm that a document with that id exists.

## Signing in

### `POST /api/auth/register`
`{ displayName, email, password }` → `201` `SessionUser`, and sets the cookie.
Passwords must be at least 8 characters. A duplicate email answers `409`.
The timezone is defaulted server-side, not asked for at registration.

### `POST /api/auth/login`
`{ email, password }` → `200` `SessionUser`, and sets the cookie.
The email is matched case- and whitespace-insensitively. A wrong address and a
wrong password give the same answer and take the same time, so this endpoint
cannot be used to find out who has an account.

### `POST /api/auth/logout`
→ `200 { signedOut: true }`. Deletes the session row, so it is over everywhere.

### `GET /api/auth/me`
→ `200 { user: SessionUser | null }`. Answers `200` with `null` when nobody is
signed in: that is a normal state, not an error.

## Documents

### `GET /api/documents`
→ `DocumentSummary[]`, newest first, only yours.

`issuer` and `documentType` are null until a reading has succeeded: a document
that is still processing, or that failed, has not told anyone who it is from.
The interface labels those rows from `uploadedAt` and `pageCount`. A failed
document carries `failure`, so a list can draw the right affordance without
fetching the detail of every failed row.

### `POST /api/documents`
`multipart/form-data`, one or more files under **`pages`**, in the order they
were photographed. → `201 { id, status: "processing" }`.

Images and PDF, up to `MAX_PAGE_BYTES` each, at most `MAX_PAGES` pages: import
both limits from `src/lib/contract/api.ts` so the capture screen can stop the
person at page ten rather than rejecting ten deliberate photographs at the end.
The upload is all-or-nothing; an over-limit request answers `invalid_request`
with `fields.pages` saying which page and why.

Returns as soon as the files are stored; the reading happens afterwards. The
interface polls `GET /api/documents/:id` until `status` is no longer
`processing`.

Validate on the server, not only in the file input: the `accept` attribute is a
hint to the person choosing a file, not a constraint on what arrives.

### `GET /api/documents/:id`
→ `DocumentDetail`: the summary, plus `fields`, plus `pages`.

`fields` is empty while status is `processing`, and for a document that has
never been read successfully. Otherwise it holds the most recent successful
reading, in reading order, with a person's correction taking precedence over
what the model said. Each carries `rawText`: the snippet on the page the value
came from.

All six fields are always present in `fields`; how many become rows on screen
is presentation. Two defaults, open to review: `document_type` belongs in the
screen's header rather than the field list (the prototype titles the review
screen with it), and an `amount` whose value is `NO_PAYMENT_REQUIRED` (import
the constant from `src/lib/contract/fields.ts`, never retype the string) may be
hidden rather than shown as a row. Hiding a row never means dropping the data.

### `POST /api/documents/:id/confirm`
Body: `ConfirmDocumentRequest`. → `200 { documentId, task: TaskSummary }`.

The returned task includes its reminders, so the calendar the person lands on
can draw itself without a second request.

**Send only the fields the person changed.** This rule is load-bearing and the
easiest one to break by accident: the lazy implementation POSTs all six fields
back, every unchanged value is recorded as a correction, and the numbers we
use to measure how often the reader is wrong are quietly destroyed from day
one, with no error anywhere. Corrections are the accuracy data.

`acknowledged` lists the keys of every flagged field (status `uncertain` or
`unreadable`) the person saw and accepted without editing. A flagged field that
appears in neither `fields` nor `acknowledged` answers `409`: the screen
promises "never from a date you haven't checked", and this is what makes that
promise checkable rather than decorative.

A `due_date` value must be `'YYYY-MM-DD'`. The review screen's date box is free
text, so parse what the person typed with `parseHumanDate()` (day-first,
Australian) before sending; a value the server cannot read answers
`invalid_request` with `fields.due_date`.

Default decisions, open to review:

- **An unreadable field does not block confirming.** The person may supply a
  value, but an empty unreadable field stays empty and the task is created
  anyway. Blocking would trap the person on a form they cannot complete, which
  is a worse failure for this audience than a missing reference number.
- **The task's title is `` `${action_required} (${issuer})` ``**, mechanical
  and predictable. The prototype's hand-written titles ("Pay AGL electricity
  bill") cannot be derived from the six fields; a nicer rule is a product
  conversation, not an implementation detail.

Confirming is the moment a document becomes a task with reminders, all in one
transaction. The scheduling rule lives in `src/lib/contract/reminders.ts` and
nowhere else: a deadline gets reminders 7 days and 1 day before at 9 am local,
an appointment (anything with a `due_time`) gets one, the day before. The
confirm handler must call `planReminders()` rather than restating those
numbers, because the review screen shows the same plan to the person before
they agree, computed by the same function. Confirming twice answers `409`.

### `POST /api/documents/:id/retry`
Empty body. → `202 { id, status: "processing" }`.

Re-reads the pages already on file as a new attempt. Answers `409` unless the
document's status is `failed`. This is the action behind the failed row's
button when the failure does not need a new photograph: the prototype's retake
control does exactly this, and a transient failure that exhausted its automatic
retries lands here too.

### `POST /api/documents/:id/retake`
`multipart/form-data`, same shape as upload. → `202 { id, status: "processing" }`.

A fresh set of photographs for the same document: the new pages are stored as a
new attempt and read again. The document keeps its id, and previous attempts,
including their images, stay in the history (`document_pages` is keyed by
attempt for exactly this reason; "replace" never means "destroy the evidence").
This is the way out when `failure.canRetake` is true, which means the
photograph was the problem.

Which button a failed row shows: `canRetake` true → retake (a new photo can
fix it); `canRetake` false and kind `transient` → retry; kind
`unsupported_document` → neither, say plainly that DayKeeper cannot read this
kind of document. `FAILURE_MESSAGES` in the contract has the person-facing
wording for all three.

### `DELETE /api/documents/:id`
Archives it. Nothing is destroyed; it stays readable.

### `GET /api/documents/:id/pages/:page`
The image itself, from the current (highest) attempt. Ownership is checked here
because local storage cannot sign URLs. Answers `404` for someone else's page.

## Tasks

### `GET /api/tasks`
→ `TaskSummary[]`, excluding dismissed ones, by due date ascending with dateless
tasks last.

`status` is `upcoming`, `overdue` or `completed`, computed from the due date at
read time rather than stored, **in the user's timezone**: something due today
is not overdue until today, where the person lives, is over. Use
`deriveTaskStatus()`; the UTC comparison it replaced kept a Melbourne task
"upcoming" until ten the next morning.

Every summary carries its `reminders`, cancelled ones included with their
status saying so. This is what the calendar draws.

### `GET /api/tasks/:id`
→ `TaskDetail`: the summary plus the extracted fields of the letter it came
from, and `pageCount`. This is the calendar day-sheet's endpoint: tapping an
entry shows the letter's fields and offers the photograph, three weeks after
confirming. The same `rawText` rule as documents applies to `fields`.

### `POST /api/tasks/:id/complete`
→ `200 TaskSummary`. Cancels any reminders still waiting, in the same
transaction: being nagged about something already done is the anxiety this
product exists to remove.

### `DELETE /api/tasks/:id/complete`
Undo. Ticking something off by accident should not need an apology.

## The home screen

### `GET /api/home`
→ `HomePayload`. One request rather than three so the counts and the lists
cannot disagree with each other on screen.

- `counts`: `{ needsReview, processing, failed }`. The call-to-action needs the
  first two separately (a queue that is all still reading says "Reading your
  letters…", an empty one says "Nothing to check"); the nav badge shows
  `needsReview` alone.
- `inbox`: every document not yet dealt with, status `processing`,
  `needs-review` or `failed`, one merged list, newest upload first, not capped.
  The prototype renders these interleaved in a single card, so the server
  sends the one list they are rather than three lists the client must weave.
  The card is shown when `inbox` is non-empty, which is not the same test as
  the counts: a queue holding only failures still shows the card.
- `tasks`: the same content and order as `GET /api/tasks`, capped at 20
  (default decision; the prototype's list is uncapped, which does not survive
  contact with a real archive).

## The calendar

There is no calendar endpoint, on purpose. The calendar is drawn from
`GET /api/tasks`: an amber dot on each task's `dueDate`, a grey dot on each
reminder's `localDate`. `ReminderView.localDate` is the server-computed
calendar day in the user's zone precisely so the client never turns an instant
back into a day and gets it wrong by one.

**The invariant that makes the calendar trustworthy: only confirmed documents
contribute.** A document in `processing`, `needs-review` or `failed` produces
no task, no reminder and no mark. Nothing reaches the calendar without a
person having seen it. This is the product's central safety promise, not an
implementation detail.

## Deliberately not specified

Not oversights. Each needs a decision nobody has made yet, and guessing now
would mean building the wrong thing twice:

- **password reset** needs an email sender, and no service has been chosen
- **the admin endpoints** need the operator's permissions settled first; the
  promise on screen is that letter content is never visible there, and the audit
  table is built so it cannot be
- **settings**: profile, notifications, password change, delete account, and
  exposing the timezone the schema already stores
- **rate limiting on sign-in**, before anything is public
- **object storage**, and therefore signed URLs. The tech-stack note proposes
  the layout `documents/{user_id}/{document_id}/page-{n}.{ext}`; with attempts
  in the schema it grows an attempt segment
- **the extraction runner.** Upload answers before the reading happens, and
  *something* has to perform it: in-process after responding, a sweep over the
  `extraction_runs_status_idx` index, or a real queue. The schema supports all
  three; nobody has chosen
- **sending reminders.** They are rows with a `scheduled_for`; nothing
  dispatches them yet, and what does is a real decision (a cron job, a platform
  scheduler, in-app only)
- **the "your letters are ready" notification.** The prototype promises one
  batched email when readings finish ("One message, not one per letter", "You
  can close the app"). It is not modelled: `reminders.task_id` is NOT NULL and
  these documents have no task yet, so recording it needs a `notifications`
  table that arrives with the decision (batching window, channel, quiet hours).
  Under the no-migrations rule, adding it later is free
- **a capture-time blur check.** The capture screen promises DayKeeper "asks
  you to retake it straight away", which implies a synchronous quality gate
  before the upload answers. The provider interface deliberately has one
  method and no such gate. Either a second provider method arrives with a
  model that can actually do it, or the on-screen promise softens to the
  asynchronous reality; somebody has to pick
- **the greeting.** "Good morning, Margaret" needs a preferred name
  (`display_name` holds "Margaret Whitfield") and a clock in her zone. The
  timezone column already exists; whether the greeting varies with the time of
  day, and what it calls her, is product copy nobody has written. A
  `preferred_name` column arrives with that decision
