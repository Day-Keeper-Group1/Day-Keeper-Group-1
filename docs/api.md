# API specification

**None of this is built yet. This is the shape to build.**

It is written down first because the interface, the reader and the database are
going to be built by different people, and the only way that ends in something
that fits together is to settle the seams before the parts.

The surface below is the one in [`scope.md`](scope.md). That file says what this
release builds; this one says what each request and each response looks like. If
you are looking for an endpoint that is not in the table, read `scope.md` before
adding it: most of what is missing is missing deliberately.

The types are already in `src/lib/contract/api.ts`, and that file is the
authority on the exact shape of every body here. **Import them rather than
restating them.** The examples below are real bodies, so you can see what an
endpoint feels like to call without reading TypeScript.

Rules that are not about the wire live in the code that enforces them, with the
reasoning attached. This document names them and does not repeat them:

| what | where |
|---|---|
| the six fields, and why six is a floor | `src/lib/contract/fields.ts` |
| what a field's status means, and `open_payload` | `src/lib/contract/extraction.ts` |
| showing rather than asking, the upload limits, overdue in words | `src/lib/contract/api.ts` |
| dates, times, and whose day it is | `src/lib/contract/dates.ts` |
| the reminder ladder, and the clock check at fire time | `src/lib/contract/reminders.ts` |
| sessions, passwords, and who is asking | `src/server/auth/` |
| the tables, and why each column exists | `db/schema.sql` |

## How to read an entry

Every endpoint has the same blocks, in the same order, so that finding one fact
does not mean reading a page.

**URL**, **Method**, **Auth required** say how to call it. **Data constraints**
and **Data example** are the request. **Success Response** and **Error
Responses** are what comes back, each with its code and an example body.
**Notes** is why it is like that, and it is the only block you can skip.

Where a note says "default decision", the rule was chosen to unblock building
and is open to challenge in review; the default stands until someone argues it
down.

## How to talk to it

**Base URL** : `/api`

**Content type** : every endpoint answers `application/json`, except
`GET /api/documents/:id/pages/:page`, which redirects to an image.

**Authentication** : a `dk_session` cookie, set by sign-in and sent
automatically by the browser. Everything except the auth endpoints answers
`401` without it.

Inside a handler, who is asking is answered by exactly one function:
`requireUser()` from `src/server/auth/session.ts`. Nothing else reads the cookie
or the sessions table. The seed plants a development session so protected
endpoints can be called before sign-in exists; `npm run db:seed` prints the
cookie to use.

**Wire formats.** A date is `'YYYY-MM-DD'`, a time of day is `'HH:mm'` in 24
hours, an instant is ISO 8601 with a zone. `src/lib/contract/dates.ts` has the
helpers that keep it that way, and the reason a date never travels as a
timestamp.

**Errors always look like this**, and `message` is written to be shown to a
person as-is:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Please attach at least one photo.",
    "fields": { "pages": "Page 3 is larger than 10 MB." }
  }
}
```

| code | status | when |
|---|---|---|
| `unauthenticated` | 401 | not signed in, or the wrong password |
| `forbidden` | 403 | signed in, but not allowed (a deactivated account) |
| `not_found` | 404 | no such thing, **or it belongs to someone else** |
| `invalid_request` | 400 | the request was malformed; `fields` says where |
| `conflict` | 409 | the thing is not in a state where this makes sense |
| `server_error` | 500 | our fault |

A letter belonging to another person answers `404`, never `403`. A `403` would
confirm that a letter with that id exists.

## Every endpoint

| what | method and path |
|---|---|
| Sign in | `POST /api/auth/login` |
| Sign out | `POST /api/auth/logout` |
| Who is signed in | `GET /api/auth/me` |
| Upload a letter | `POST /api/documents` |
| List letters | `GET /api/documents` |
| One letter, in full | `GET /api/documents/:id` |
| Confirm a letter | `POST /api/documents/:id/confirm` |
| A page image | `GET /api/documents/:id/pages/:page` |
| List tasks | `GET /api/tasks` |
| One task, in full | `GET /api/tasks/:id` |
| Tick a task off | `POST /api/tasks/:id/complete` |
| Undo that | `DELETE /api/tasks/:id/complete` |
| Everything the home screen needs | `GET /api/home` |

There is no calendar endpoint, on purpose. See "The calendar".

Accounts come from the seed: this release signs people in and does not register
them.

---

# Signing in

## Sign in

Exchanges an email and password for a session.

**URL** : `/api/auth/login`

**Method** : `POST`

**Auth required** : NO

**Data example**

```json
{ "email": "margaret@example.com", "password": "daykeeper" }
```

### Success Response

**Code** : `200 OK`, and the `dk_session` cookie is set.

**Content example**

```json
{
  "id": "0f2b7d5c-1a44-4c9e-9a1f-2c7d3e5b8a10",
  "email": "margaret@example.com",
  "displayName": "Margaret Whitfield",
  "role": "user",
  "timeZone": "Australia/Melbourne"
}
```

### Error Responses

**Condition** : Wrong email, or wrong password.
**Code** : `401 UNAUTHORIZED`

**Content example**

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "That email and password do not match."
  }
}
```

### Notes

The email is matched case- and whitespace-insensitively.

A wrong address and a wrong password give the same answer and take the same
time, so this endpoint cannot be used to find out who has an account. The
comparison that keeps the timing equal is in `src/server/auth/password.ts`.

## Sign out

Ends the session everywhere, not just in this browser.

**URL** : `/api/auth/logout`

**Method** : `POST`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content**

```json
{ "signedOut": true }
```

### Notes

Deletes the session row rather than only clearing the cookie, which is what
makes it true everywhere.

## Who is signed in

What the interface asks on load to decide whether to show the app or the
sign-in screen.

**URL** : `/api/auth/me`

**Method** : `GET`

**Auth required** : NO

### Success Response

**Code** : `200 OK`

**Content example**

```json
{ "user": null }
```

A signed-in caller gets the same `SessionUser` object sign-in returns, under
`user`.

### Notes

Nobody being signed in answers `200` with `null`, not `401`. That is a normal
state, not an error, and treating it as one makes every caller handle a failure
that has not happened.

---

# Letters

## Upload a letter

Stores the photographs and answers immediately with the letter they became.

**URL** : `/api/documents`

**Method** : `POST`

**Auth required** : YES

**Data constraints**

`multipart/form-data`, one or more files under **`pages`**. **Every photograph
in one upload belongs to one letter**, and the order they are sent is the page
order, because with one letter to an upload there is nothing else it could be.

Images only, each within `MAX_PAGE_BYTES` and at most `MAX_PAGES` of them. Both
constants are in `src/lib/contract/api.ts`; import them, so the capture screen
can stop the person at the last page rather than rejecting a deliberate
photograph at the end.

Those two checks, the file type and the size, are the only checks made on an
upload. Nothing here judges whether the photograph is a letter or whether it can
be read; see [`scope.md`](scope.md).

**Data example**

```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Cookie: dk_session=$DK_SESSION" \
  -F "pages=@page-1.jpg" \
  -F "pages=@page-2.jpg"
```

### Success Response

**Code** : `201 CREATED`

**Content example**

```json
{
  "id": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
  "issuer": null,
  "documentType": null,
  "status": "processing",
  "uploadedAt": "2026-08-10T09:12:44+10:00",
  "pageCount": 2
}
```

### Error Responses

**Condition** : No files, more than `MAX_PAGES`, one over `MAX_PAGE_BYTES`, or a
file that is not an image. The upload is all-or-nothing.
**Code** : `400 BAD REQUEST`

**Content example**

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Please attach at least one photo.",
    "fields": { "pages": "Page 3 is larger than 10 MB." }
  }
}
```

### Notes

**The response carries no reading, because at the moment the files are stored
nothing has looked at them.** The handler answers as soon as the photographs are
in the bucket and the rows are written; the one model call happens after, and
the letter sits at `processing` until it comes back.

Validate on the server, not only in the file input: the `accept` attribute is a
hint to the person choosing a file, not a constraint on what arrives.

**Polling is one request.** While anything of this person's is still being read,
the interface polls `GET /api/home` every five seconds and stops when
`counts.processing` reaches zero. The count and the row come out of the same
payload, so one poll refreshes both, and neither can show a different answer
from the other.

If the reading fails, the letter's status becomes `failed`, and nothing takes it
further. Repair is out of scope, so there is no retry endpoint and no retake
endpoint.

## List letters

Every letter this person has, newest first. This is the letters area.

**URL** : `/api/documents`

**Method** : `GET`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content example**

```json
[
  {
    "id": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
    "issuer": "AGL Energy",
    "documentType": "Electricity bill",
    "status": "needs-review",
    "dueDate": "2026-08-15",
    "amount": "$347.60",
    "uploadedAt": "2026-08-10T09:12:44+10:00",
    "pageCount": 2
  },
  {
    "id": "b71c0d54-8e33-4a77-8c19-90ab4e6f2213",
    "issuer": null,
    "documentType": null,
    "status": "processing",
    "uploadedAt": "2026-08-10T09:12:44+10:00",
    "pageCount": 1
  }
]
```

### Notes

`issuer` and `documentType` are null until a reading has succeeded: a letter
still being read has not told anyone who it is from, so a row for it has its
upload time and its page count and nothing else to be called by.

Nobody edits these. They are written from the reading, and only from values the
model was confident of.

**This list is the door.** Every letter is here, including ones that never
became a task because the reading found nothing to do, and opening one shows the
photographs that came with it.

## One letter, in full

The review screen's endpoint: the letter, its fields, and its pages.

**URL** : `/api/documents/:id`

**Method** : `GET`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content example**

```json
{
  "id": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
  "issuer": "AGL Energy",
  "documentType": "Electricity bill",
  "status": "needs-review",
  "dueDate": "2026-08-15",
  "amount": "$347.60",
  "uploadedAt": "2026-08-10T09:12:44+10:00",
  "pageCount": 2,
  "fields": [
    {
      "key": "document_type",
      "label": "Document type",
      "value": "Electricity bill",
      "status": "confirmed"
    },
    {
      "key": "issuer",
      "label": "From",
      "value": "AGL Energy",
      "status": "confirmed"
    },
    {
      "key": "action_required",
      "label": "What to do",
      "value": "Pay the electricity bill",
      "status": "confirmed"
    },
    {
      "key": "due_date",
      "label": "Due date",
      "value": "15 Aug 2026",
      "status": "confirmed"
    },
    {
      "key": "amount",
      "label": "Amount",
      "value": "$347.60",
      "status": "confirmed"
    },
    {
      "key": "reference",
      "label": "Reference",
      "value": null,
      "status": "unreadable"
    }
  ],
  "pages": [
    {
      "id": "7c0e1b2a-55d4-4c31-9f2b-0a8e6d17c003",
      "pageNumber": 1,
      "url": "/api/documents/3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004/pages/1"
    },
    {
      "id": "88d3a9c1-2e40-47bb-b1a4-5f6e0c92d114",
      "pageNumber": 2,
      "url": "/api/documents/3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004/pages/2"
    }
  ]
}
```

### Error Responses

**Condition** : No such letter, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

`fields` is empty while the status is `processing`, and for a letter that was
never read successfully. Otherwise it holds the reading, in the order
`src/lib/contract/fields.ts` gives.

All six fields are always present in `fields`, whatever a screen chooses to
draw. A field can also carry `NO_PAYMENT_REQUIRED` or `NOT_APPLICABLE`, both
exported from that same file: those are confident answers about the letter, not
absences, so a screen that hides such a row is hiding a row and not dropping
data. Import the constants; never retype the strings.

`value` is display text, formatted on the server, so a date arrives as
`15 Aug 2026` rather than ISO. `value` is null exactly when the status is
`unreadable`, and `src/lib/contract/extraction.ts` says what each status means
and why a value the model was unsure of never reaches this response.

**The screen shows, it never asks.** Nothing in this payload is editable and
nothing in it is a question, which is why there is no correction endpoint
anywhere in this document. The reasoning is in `src/lib/contract/api.ts`.

## Confirm a letter

Accepts a letter as read, and turns it into a task with reminders.

**URL** : `/api/documents/:id/confirm`

**Method** : `POST`

**Auth required** : YES

**Data constraints**

**Empty body.** The person looked, the person nodded, that is the entire
message. There is no fields array and no acknowledged array; see
`src/lib/contract/api.ts`.

### Success Response

**Code** : `200 OK`

**Content example**

```json
{
  "documentId": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
  "task": {
    "id": "5b8c2f19-0e77-4d3a-9c41-6f2a7b0d1e55",
    "title": "Pay the electricity bill (AGL Energy)",
    "documentId": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
    "issuer": "AGL Energy",
    "dueDate": "2026-08-15",
    "status": "upcoming",
    "reminders": [
      {
        "id": "4e7a2b90-1c55-4f08-8d21-7b3f9a0c6e42",
        "scheduledFor": "2026-08-12T09:00:00+10:00",
        "localDate": "2026-08-12",
        "localTime": "09:00",
        "channel": "in_app",
        "status": "scheduled"
      },
      {
        "id": "9d1f4c02-3b6e-4a18-8f70-2c5d9e3a7b11",
        "scheduledFor": "2026-08-14T09:00:00+10:00",
        "localDate": "2026-08-14",
        "localTime": "09:00",
        "channel": "in_app",
        "status": "scheduled"
      }
    ]
  }
}
```

Two reminders here, not three: the bill is due on the 15th and was confirmed on
the 10th, so the earliest rung of the ladder would have landed in the past, and
a reminder in the past is never created. `planReminders()` in
`src/lib/contract/reminders.ts` is what drops it.

### Error Responses

**Condition** : The letter has already been confirmed.
**Code** : `409 CONFLICT`

It renders as a line above the button, since the confirm button navigates
unconditionally and has nowhere else to put one. The `message` is written to be
shown as-is.

**Condition** : No such letter, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

The returned task includes its reminders, so the calendar the person lands on
can draw itself without a second request.

Confirming is the moment a letter becomes a task with reminders, all in one
transaction. The schedule comes from `planReminders()` and nowhere else. **The
review screen and this handler must pass it the same `today`**, or the card
promises a reminder the handler never creates; that file says why passing the
day is what makes the two answers identical, rather than sharing the function.

**What confirming means is exact**: a person saw this reading and accepted it.
That is the only way anything reaches the calendar.

Default decisions, open to review:

- **An unreadable field does not block confirming.** It stays empty and the task
  is created anyway. Blocking would trap the person on a screen that offers her
  nothing to fix, which is a worse failure for this audience than a missing
  reference number.
- **The task's title is `action_required (issuer)`**, mechanical and
  predictable. Because either half can be empty and `tasks.title` is NOT NULL,
  it falls back in order: `action_required (issuer)`, then `action_required`,
  then `Letter from issuer`, then the document type, then `Letter`. Nobody
  should ever meet a task called `()`.
- **A letter that names no date becomes a task with no due date**, no reminders
  and no calendar mark. `planReminders()` is not called at all: it takes a date
  and throws without one.

## A page image

The photograph itself.

**URL** : `/api/documents/:id/pages/:page`

**Method** : `GET`

**Auth required** : YES

**Data constraints** : `:page` is the page number as the person counts it, from
1.

### Success Response

**Code** : `302 FOUND`, `Location` being a time-limited link storage signed.

### Error Responses

**Condition** : No such page, or the letter belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

**This is where ownership is checked**, and then the bytes go straight from the
bucket to the browser and never through the application. The check lives here
rather than in the link, because a signed link expires but never asks who is
holding it. `src/server/storage.ts` is the only thing that reads or writes those
bytes.

Pages travel in a payload as this path and not as a signed link, so that nothing
in a response goes stale while it sits in a cache.

---

# Tasks

## List tasks

Everything on this person's list, and the only source the calendar is drawn
from.

**URL** : `/api/tasks`

**Method** : `GET`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content example**

```json
[
  {
    "id": "5b8c2f19-0e77-4d3a-9c41-6f2a7b0d1e55",
    "title": "Pay the electricity bill (AGL Energy)",
    "documentId": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
    "issuer": "AGL Energy",
    "dueDate": "2026-08-15",
    "status": "upcoming",
    "reminders": [
      {
        "id": "4e7a2b90-1c55-4f08-8d21-7b3f9a0c6e42",
        "scheduledFor": "2026-08-12T09:00:00+10:00",
        "localDate": "2026-08-12",
        "localTime": "09:00",
        "channel": "in_app",
        "status": "scheduled"
      },
      {
        "id": "9d1f4c02-3b6e-4a18-8f70-2c5d9e3a7b11",
        "scheduledFor": "2026-08-14T09:00:00+10:00",
        "localDate": "2026-08-14",
        "localTime": "09:00",
        "channel": "in_app",
        "status": "scheduled"
      }
    ]
  }
]
```

### Notes

Order is due date ascending, with dateless tasks last. A list about deadlines
that is not ordered by deadline is a list you have to read all of, and the sort
is also what lifts an overdue task to the top, because an overdue date is
smaller than every upcoming one.

**Uncapped, and it has to stay uncapped**, because the calendar is drawn from it
and a capped list draws a month whose marks stop partway through with no error
anywhere. Do not serve the calendar from `HomePayload.tasks`, which is capped:
the two would then disagree on screen, which is the exact failure
`GET /api/home` exists to prevent. A date-range parameter is the obvious answer
once a person has enough tasks for this to hurt. **Open.**

`status` is `upcoming`, `overdue` or `completed`, computed from the due date at
read time rather than stored, in the user's timezone. Use `deriveTaskStatus()`
from `src/lib/contract/api.ts`, which is also where what overdue looks like on
screen is settled.

A task with no `dueDate` draws no calendar mark and has no reminders.

Dismissed tasks are excluded. Nothing writes that state this semester; the
filter is here so that adding the action later is a one-line change.

Every summary carries its `reminders`, whatever their status: `scheduled`,
`sent`, `skipped` or `failed`. This is what the calendar draws, and the day
sheet words each one from its status.

## One task, in full

The calendar day sheet's endpoint: the task, the letter's fields, and enough to
offer the photograph.

**URL** : `/api/tasks/:id`

**Method** : `GET`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content** : `TaskDetail`, which is the summary above plus `documentId`,
`fields` (as in `GET /api/documents/:id`) and `pageCount`.

### Error Responses

**Condition** : No such task, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

This is what makes "what said so?" answerable three weeks after confirming:
tapping an entry shows the letter's fields and offers the photograph.

`fields` follows the same rules as `GET /api/documents/:id`.

## Tick a task off

Marks it done. That is the entire write.

**URL** : `/api/tasks/:id/complete`

**Method** : `POST`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content** : `TaskSummary`, with `status: "completed"`. Its reminders come back
untouched, still saying `scheduled`: they will simply not fire.

### Error Responses

**Condition** : No such task, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

**No reminder row is written.** The dispatcher reads the task at the moment a
reminder's time arrives and decides then whether to send;
`src/lib/contract/reminders.ts` has that rule and the reason it lives at fire
time rather than here. So "reminders off" on screen is derived truth, not a
stored flag, and there is no bookkeeping for an untick to undo.

## Undo that

Puts a task back on the list. Also the entire write.

**URL** : `/api/tasks/:id/complete`

**Method** : `DELETE`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content** : `TaskSummary`, open again. If its due date has passed, `status`
comes back `overdue`, because that is what the arithmetic now says.

### Error Responses

**Condition** : No such task, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

Ticking something off by accident should not need an apology, however long ago
the accident was: this works on any completed task, forever.

Nothing happens to reminders, in either direction. One whose time is still ahead
will find the task open when its moment comes, and fire. One whose time has
passed is history and stays what it became. The clock only rings forward, so
unticking an old task cannot set off a late nag.

---

# The home screen

## Everything the home screen needs

One request rather than three, so the counts and the lists cannot disagree with
each other on screen.

**URL** : `/api/home`

**Method** : `GET`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content example**

```json
{
  "counts": { "needsReview": 1, "processing": 1, "failed": 0 },
  "inbox": [
    {
      "id": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
      "issuer": "AGL Energy",
      "documentType": "Electricity bill",
      "status": "needs-review",
      "dueDate": "2026-08-15",
      "amount": "$347.60",
      "uploadedAt": "2026-08-10T09:01:02+10:00",
      "pageCount": 2
    },
    {
      "id": "b71c0d54-8e33-4a77-8c19-90ab4e6f2213",
      "issuer": null,
      "documentType": null,
      "status": "processing",
      "uploadedAt": "2026-08-10T08:57:31+10:00",
      "pageCount": 1
    }
  ],
  "tasks": []
}
```

The counts and the lists describe the same world: one letter needs review, one
is still being read, and both sit in `inbox`.

### Notes

- `counts`: `{ needsReview, processing, failed }`. The call to action is an
  ordered test, in this order: `needsReview > 0` says "N things need your OK",
  otherwise `processing > 0` says "Reading your letters...", otherwise the panel
  goes inert and says "Nothing to check right now". `failed` does not enter it.
  Order matters and the obvious paraphrase gets it wrong: "a queue that is *all*
  still reading" would say "Nothing to check" while a letter is visibly being
  read in the card below it. The nav badge shows `needsReview` alone.
- `inbox`: every letter not yet dealt with, status `processing`, `needs-review`
  or `failed`, one merged list, newest upload first, not capped. The card is
  shown when `inbox` is non-empty, which is not the same test as the counts: a
  queue holding only failures still shows the card.
- `tasks`: **every open task, whatever its date, plus anything completed in the
  last seven days**, by due date ascending with dateless tasks last, capped at
  20. Open tasks are never filtered by date: an unpaid bill from three weeks ago
  is the loudest thing this person owns, and the ascending sort already puts it
  first. (An earlier draft said "open tasks due today or later", which reads
  sensibly and quietly removes exactly that bill from the screen; the wording
  here is deliberate.) Completed rows are the only ones that age out: seven days
  from the tick, so a row does not vanish from under the finger that just ticked
  it, and a card headed "Coming up" does not become twenty struck-through rows
  from last March. The cap of 20 is a default decision.

---

# The calendar

**There is no calendar endpoint, on purpose.**

The calendar is drawn from `GET /api/tasks`: one mark on each task's `dueDate`,
another on each reminder's `localDate`. What those marks look like is in
[`theme.md`](theme.md).

`ReminderView.localDate` is the server-computed calendar day in the user's zone,
and `localTime` is computed beside it, so the client never turns an instant back
into a day and gets it wrong by one, and the day sheet's "a reminder goes out
this morning, 9 am" is data rather than copy.

**Every reminder that exists gets a mark, whatever its status**, including ones
already sent and ones skipped because the task was already done when the clock
rang. A mark is a record of what this day held, not a forecast. The day sheet
words each entry from the task and the day: a still-scheduled reminder for an
open task gets the present tense, a day already behind today gets the past
tense, and a ticked-off task gets "No reminder, this is already done", so the
sheet never announces a nag that will never be sent.

A reminder whose day has already gone by is never planned and never created, so
it has no mark. That is why the plan card and the calendar always agree: the
person is shown the reminders that will happen, agrees to those, and sees marks
for exactly those. Seeded data is the one exception, and deliberately so: it is
building a world that already happened, so it plants past reminders already
marked `sent`, and those do get marks.

**The invariant that makes the calendar trustworthy: only a confirmed letter
contributes.** A letter in `processing`, `needs-review` or `failed` produces no
task, no reminder and no mark. Nothing reaches the calendar without a person
having seen it. This is the product's central safety promise, not an
implementation detail, and `src/lib/contract/api.ts` is where the shape that
guarantees it is written down.

---

# Deliberately not specified

Not oversights. Each needs a decision nobody has made yet, and guessing now
would mean building the wrong thing twice.

- **the extraction runner.** Upload answers before the reading happens, and
  *something* has to perform it: in-process after responding, a sweep over the
  waiting extraction runs, or a real queue. The schema supports all three;
  nobody has chosen
- **sending reminders, the transport half.** What the dispatcher decides is
  settled, in `src/lib/contract/reminders.ts`. What is still open is what wakes
  it up: a cron job, a platform scheduler, or in-app only
- **what the capture screen does at the limits.** A current phone camera clears
  `MAX_PAGE_BYTES` per frame routinely. Whether the client downscales to fit or
  refuses the photograph, and what the screen says at the last page, is
  undecided. Refusing silently loses a photograph the person deliberately took,
  which is the failure the limits are exported to prevent
- **rate limiting on sign-in**, before anything is public

## Development only: try the reader

Two URLs exist while `NODE_ENV` is not `production`, and answer `404` when it is. Neither is part of the product API above; they let the reading step be tried from a browser before it is wired into `POST /api/documents`.

`GET /api-docs` is a Swagger page. `POST /api/dev/extract` takes one or more photographed pages of one letter as the multipart field `pages`, calls whichever reader `AI_EXTRACTION_PROVIDER` names, validates the answer against the extraction contract, and returns `{ provider, model, result }` where `result` is the contract shape. Nothing is stored and no sign-in is asked for. Its OpenAPI description is `GET /api/openapi.json`. Sample letters are in `data/synthetic-letters/`.
