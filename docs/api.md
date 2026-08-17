# API specification

**None of this is built yet. This is the shape to build.**

It is written down first because the interface, the reader and the database are
going to be built by different people, and the only way that ends in something
that fits together is to settle the seams before the parts.

The types are already in `src/lib/contract/api.ts`: `DocumentSummary`,
`DocumentDetail`, `TaskSummary`, `TaskDetail`, `ReminderView`, `HomePayload`,
`ExtractedFieldView`, `SessionUser`, `ApiError`. **Import them rather than
restating them.** They match what the interface needs, so a handler that
returns one of these needs no translation on the way to the screen.

This specification was written after building the whole thing once as a spike
and throwing it away, then checked line by line against the product prototype
(`docs/prototype/user/daykeeper-sketch-live.html`), which is the UX authority.
Where the two disagree, the prototype is right and this document changes.

## How to read an entry

Every endpoint below has the same blocks, in the same order, so that finding
one fact does not mean reading a page:

**URL**, **Method**, **Auth required** say how to call it. **Data constraints**
and **Data example** are the request. **Success Response** and **Error
Responses** are what comes back, each with its code and an example body.
**Notes** is why it is like that, and it is the only block you can skip.

Where a note says "default decision", the rule was chosen to unblock building
and is explicitly open to challenge in review; the default stands until someone
argues it down. Where it says **Open**, nobody has decided and guessing would
mean building the wrong thing twice; those are collected at the end so they can
be worked through rather than discovered one at a time.

## How to talk to it

**Base URL** : `/api`

**Content type** : every endpoint answers `application/json`, except
`GET /api/documents/:id/pages/:page`, which redirects to an image.

**Authentication** : a `dk_session` cookie, set by sign-in and sent
automatically by the browser. Everything except the auth endpoints answers
`401` without it.

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

A document belonging to another person answers `404`, never `403`. A `403`
would confirm that a document with that id exists.

## Every endpoint

| what | method and path |
|---|---|
| Register | `POST /api/auth/register` |
| Sign in | `POST /api/auth/login` |
| Sign out | `POST /api/auth/logout` |
| Who am I | `GET /api/auth/me` |
| List documents | `GET /api/documents` |
| Post a pile of photographs | `POST /api/documents` |
| Watch a batch being divided | `GET /api/batches/:id` |
| One document, in full | `GET /api/documents/:id` |
| Confirm a document | `POST /api/documents/:id/confirm` |
| Read a failed document again | `POST /api/documents/:id/retry` |
| Put a document away | `DELETE /api/documents/:id` |
| A page image | `GET /api/documents/:id/pages/:page` |
| List tasks | `GET /api/tasks` |
| One task, in full | `GET /api/tasks/:id` |
| Tick a task off | `POST /api/tasks/:id/complete` |
| Undo that | `DELETE /api/tasks/:id/complete` |
| Everything the home screen needs | `GET /api/home` |

There is no calendar endpoint and no retake endpoint, both on purpose. See
"The calendar" and the notes on `/retry`.

---

# Signing in

## Register

Creates an account, signs the person in, and returns them.

**URL** : `/api/auth/register`

**Method** : `POST`

**Auth required** : NO

**Data constraints**

```json
{
  "displayName": "[1 or more characters]",
  "email": "[valid email address]",
  "password": "[8 or more characters]"
}
```

**Data example**

```json
{
  "displayName": "Margaret Whitfield",
  "email": "margaret@example.com",
  "password": "daykeeper"
}
```

### Success Response

**Code** : `201 CREATED`, and the `dk_session` cookie is set.

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

**Condition** : The email already has an account.
**Code** : `409 CONFLICT`

**Condition** : The password is shorter than 8 characters, or a field is
missing.
**Code** : `400 BAD REQUEST`, with `fields` naming which.

### Notes

The timezone is defaulted server-side, not asked for at registration.

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

**Content** : `SessionUser`, as above.

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
time, so this endpoint cannot be used to find out who has an account.

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

## Who am I

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

### Notes

Nobody being signed in answers `200` with `null`, not `401`. That is a normal
state, not an error, and treating it as one makes every caller handle a failure
that has not happened.

---

# Documents

## List documents

Every letter this person has, newest first.

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
    "label": "AGL Energy · Electricity bill",
    "status": "needs-review",
    "dueDate": "2026-08-15",
    "amount": "$347.60",
    "reference": "4021 9987 1",
    "uploadedAt": "2026-08-10T09:12:44+10:00",
    "pageCount": 2
  },
  {
    "id": "b71c0d54-8e33-4a77-8c19-90ab4e6f2213",
    "issuer": null,
    "documentType": null,
    "label": "City of Yarra",
    "status": "processing",
    "uploadedAt": "2026-08-10T09:12:44+10:00",
    "pageCount": 1
  }
]
```

### Notes

`issuer` and `documentType` are null until a reading has succeeded: a document
that is still processing, or that failed, has not told anyone who it is from.
A failed document carries `failure`, so a list can draw the right affordance
without fetching the detail of every failed row.

**Every row has a name from the moment it exists**, and the server writes it,
not the client: `label` is always present, and is `` `${issuer} · ${documentType}` ``
once the six fields have been read, and the provisional label the division gave
it before then.

A letter can be named that early because the pass that divided the pile had
already read the letterhead; naming each one costs nothing extra and is the
difference between a queue and three identical rows saying "reading…". The
thing that genuinely cannot be named is a batch that has not been divided yet,
and `BatchSummary` does not pretend otherwise: it says how many photographs it
holds, which is all anybody knows about it.

Resolving the label in one place is the same rule as `FIELD_LABELS` and
`FAILURE_MESSAGES`: two screens show this string and they must not word it
differently.

**No screen asks whether the dividing was right.** A merge shows itself as one
letter whose fields contradict each other, and a split as two letters, one with
half its fields unreadable. Both surface on the review screen the person is
already looking at, so a step in front of it would catch nothing and would hand
the sorting back to somebody this product exists to sort for. She is never told
that photographs one and three became one letter; she is told there is an
electricity bill for $347.60 due on the fifteenth, and asked whether that is
right. The one error that surfaces nowhere is a real letter judged to be no
letter at all; that is the sharpest part of the miss-rate bet, and ADR 005
names it.

## Post a pile of photographs

Stores the photographs and answers immediately with the batch they arrived in.

**URL** : `/api/documents`

**Method** : `POST`

**Auth required** : YES

**Data constraints**

`multipart/form-data`, one or more files under **`pages`**. Their order is
recorded and nothing depends on it.

Images and PDF, up to `MAX_PAGE_BYTES` (10 MB) each, at most `MAX_PAGES` (10)
pages. Import both limits from `src/lib/contract/api.ts` so the capture screen
can stop the person at page ten rather than rejecting ten deliberate
photographs at the end.

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
  "id": "e2d41a90-77bc-4f0e-8a55-1cc4b9d33f21",
  "status": "uploaded",
  "pageCount": 5,
  "uploadedAt": "2026-08-10T09:12:44+10:00",
  "documents": []
}
```

### Error Responses

**Condition** : No files, more than ten, or one over ten megabytes. The upload
is all-or-nothing.
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

**An upload is a pile, and a pile obeys no rules.** Somebody photographs a
week of post in whatever order their hands fall, or picks photos out of their
album in whatever order they find them: one letter's pages shuffled between
another's, a photograph of a grandchild in the middle. The reading looks at
all of them and answers with the letters it found; the pages of each letter
come back in reading order because the reading can see "Page 2 of 3" printed
on a sheet, which the upload order never could. A photograph that is part of
no letter becomes nothing, which is an answer, not a leftover.

`POST` cannot answer with a document because at the moment the files are
stored, nothing knows what is in them. It returns as soon as the files are
stored; the dividing and the reading happen afterwards. The screen shows one
row for the batch while it is being divided, and that row becomes several. See
`docs/architecture/adr-005-ingestion-and-grouping.md`.

Validate on the server, not only in the file input: the `accept` attribute is a
hint to the person choosing a file, not a constraint on what arrives.

**Polling is one request, not one per document.** While anything of this
person's is still being divided or read, the interface polls `GET /api/home`
every five seconds and stops when `counts.processing` reaches zero and
`dividing` is empty. The capture screen's "Posted just now" card and the home
screen's "To check" card are the same lists (`HomePayload.dividing` then
`inbox`) drawn twice, which is why one poll refreshes both, and why neither can
show a different answer from the other. A `failed` row never changes on its
own, so it is not a reason to keep polling.

## Watch a batch being divided

What the capture screen watches when it has just posted and does not yet want
the whole home payload.

**URL** : `/api/batches/:id`

**Method** : `GET`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content example**

```json
{
  "id": "e2d41a90-77bc-4f0e-8a55-1cc4b9d33f21",
  "status": "grouped",
  "pageCount": 5,
  "uploadedAt": "2026-08-10T09:12:44+10:00",
  "documents": [
    {
      "id": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
      "issuer": null,
      "documentType": null,
      "label": "City of Yarra rates notice",
      "status": "processing",
      "uploadedAt": "2026-08-10T09:12:44+10:00",
      "pageCount": 2
    }
  ]
}
```

A batch that could not be divided answers `200` with `status: "failed"` and a
`failure` object:

```json
{
  "id": "e2d41a90-77bc-4f0e-8a55-1cc4b9d33f21",
  "status": "failed",
  "pageCount": 5,
  "uploadedAt": "2026-08-10T09:12:44+10:00",
  "documents": [],
  "failure": {
    "kind": "unreadable_image",
    "message": "The photo was too blurry to read. Please take it again.",
    "canRetake": true
  }
}
```

### Error Responses

**Condition** : No such batch, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

`documents` is empty until the dividing finishes and then holds every letter
the batch turned out to contain, each one a `DocumentSummary` at whatever stage
of reading it has reached.

Photographs the reading said were not letters appear in no document and nothing
shows them; whether the batch should say a word about them is **open** (see the
list at the end).

A failed batch does not lose its photographs: they stay in the batch, and
retrying re-reads them.

## One document, in full

The review screen's endpoint: the summary, its fields, and its pages.

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
  "label": "AGL Energy · Electricity bill",
  "status": "needs-review",
  "dueDate": "2026-08-15",
  "amount": "$347.60",
  "reference": "4021 9987 1",
  "uploadedAt": "2026-08-10T09:12:44+10:00",
  "pageCount": 2,
  "fields": [
    {
      "key": "document_type",
      "label": "Document type",
      "value": "Electricity bill",
      "rawText": "Tax invoice",
      "status": "confirmed"
    },
    {
      "key": "issuer",
      "label": "From",
      "value": "AGL Energy",
      "rawText": "AGL Energy Limited",
      "status": "confirmed"
    },
    {
      "key": "action_required",
      "label": "What to do",
      "value": "Pay the electricity bill",
      "rawText": "Amount due on 15/08/26",
      "status": "confirmed"
    },
    {
      "key": "due_date",
      "label": "Due date",
      "value": "15 Aug 2026",
      "rawText": "15/08/26",
      "status": "uncertain"
    },
    {
      "key": "amount",
      "label": "Amount",
      "value": "$347.60",
      "rawText": "TOTAL DUE $347.60",
      "status": "confirmed"
    },
    {
      "key": "reference",
      "label": "Reference",
      "value": null,
      "rawText": null,
      "status": "unreadable"
    }
  ],
  "pages": [
    {
      "id": "7c0e1b2a-55d4-4c31-9f2b-0a8e6d17c003",
      "pageNumber": 1,
      "url": "/api/documents/3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004/pages/1"
    }
  ]
}
```

### Error Responses

**Condition** : No such document, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

`fields` is empty while status is `processing`, and for a document that has
never been read successfully. Otherwise it holds the most recent successful
reading, in reading order, with a person's correction taking precedence over
what the model said.

`value` and `rawText` are null for exactly one case, a field the reader could
not read at all; `""` would mean the model read an empty string, which is a
different fact. `value` is display text, already formatted server-side, so
`due_date` arrives as `15 Aug 2026` rather than ISO. The screen shows what it
is given. The one place ISO travels is the confirm request coming back.

**`rawText` is carried and stored, and the prototype does not display it.**
Saying this plainly matters more than tidying it away, because three documents
in this repository assert the opposite: `AGENTS.md` says never drop it from the
review screen and that without it confirming is a rubber stamp, ADR 004 shows
a row reading "Found on document: 15/08/26", and the field above hands it to a
screen that has nowhere to put it. The prototype's flagged row asks "This was
hard to read. Is it right?" and shows the person nothing to check the value
against, which is a weaker promise than the one the other documents make.

The prototype is the authority, so the resolution is not a quiet edit here.
**Open, and it is the largest one in this document**: whether the review screen
grows a source snippet under each value, or the page image beside it, or
neither, is a product decision. The data is kept either way, so deciding late
costs nothing but deciding by accident costs the product's central claim.

The screen's header is `` `${issuer} · ${documentType}` ``, from those two
fields verbatim. The prototype's shorter headings ("Medicare" over a letter
whose From is "Services Australia") are sketch labels with no field behind
them, the same honest limitation as its hand-written task titles below.

All six fields are always present in `fields`; how many become rows on screen
is presentation. Three default decisions, open to review:

- **`document_type` belongs in the header, not the field list.** The prototype
  titles the review screen with it.
- **A field carrying a "nothing to report" constant may be hidden** rather than
  shown as a row: `NO_PAYMENT_REQUIRED` for an `amount`, `NOT_APPLICABLE` for
  anything else. Import both from `src/lib/contract/fields.ts` and never retype
  the strings. Hiding a row never means dropping the data.
- **`due_date` and `due_time` collapse into one row when both are present**,
  labelled `When` and written in the `short` style with the time appended:
  `Fri 4 Sep, 10:30 am`. An appointment happens at a moment, and splitting that
  moment across two rows makes a person assemble it themselves. A deadline,
  which has no time, keeps the plain `Due date` row in the `fact` style
  (`15 Aug 2026`). This is the one row on the screen that is two fields, so if
  it is ever flagged it is edited as two boxes, one per key, and each key
  travels separately in the confirm request.

## Confirm a document

Accepts a letter, with corrections, and turns it into a task with reminders.

**URL** : `/api/documents/:id/confirm`

**Method** : `POST`

**Auth required** : YES

**Data constraints**

`ConfirmDocumentRequest`. **`fields` carries only what the person changed.**
`acknowledged` carries the keys of every flagged field (status `uncertain` or
`unreadable`) that the person accepted without editing.

A `due_date` value must be `'YYYY-MM-DD'`. The review screen's date box is free
text, so parse what the person typed with `parseHumanDate()` (day-first,
Australian) before sending.

**Data example**

```json
{
  "fields": [{ "key": "due_date", "value": "2026-08-15" }],
  "acknowledged": ["reference"]
}
```

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
        "id": "9d1f4c02-3b6e-4a18-8f70-2c5d9e3a7b11",
        "scheduledFor": "2026-08-08T09:00:00+10:00",
        "localDate": "2026-08-08",
        "localTime": "09:00",
        "channel": "in_app",
        "status": "scheduled"
      }
    ]
  }
}
```

### Error Responses

**Condition** : A `due_date` the server cannot parse.
**Code** : `400 BAD REQUEST`, with `fields.due_date`.

**Condition** : A flagged field appears in neither `fields` nor
`acknowledged`.
**Code** : `409 CONFLICT`

**Condition** : The document has already been confirmed.
**Code** : `409 CONFLICT`

**Where those three errors appear on screen**, since the prototype's confirm
button navigates unconditionally and has nowhere to put one: `invalid_request`
with `fields.due_date` renders under that field's box, where the wrong value
still is. Both `409`s render as a line above the button. A `message` is written
to be shown as-is, so no screen needs to invent wording.

### Notes

The returned task includes its reminders, so the calendar the person lands on
can draw itself without a second request.

**Send only the fields the person changed.** This rule is load-bearing and the
easiest one to break by accident: the lazy implementation POSTs all six fields
back, every unchanged value is recorded as a correction, and the numbers we
use to measure how often the reader is wrong are quietly destroyed from day
one, with no error anywhere. Corrections are the accuracy data.

`acknowledged` lands in `extracted_fields.acknowledged_at`, beside the
correction column and without touching `status`: flipping `uncertain` to
`confirmed` would erase the fact that the model was ever unsure, which is the
same evidence corrections exist to preserve.

**Be honest about what that proves.** The review screen has one button for the
whole letter, so the client computes this array as "flagged, minus edited" and
the server could have worked that out alone. It is a record of what the person
was shown and accepted, not proof that they read it, and the `409` catches a
malformed client rather than an inattentive person. Whether a flagged row needs
its own control, which would turn the record into evidence, is a product
question for the prototype and not something this document can decide.
**Open.**

Confirming is the moment a document becomes a task with reminders, all in one
transaction. The scheduling rule lives in `src/lib/contract/reminders.ts` and
nowhere else: a deadline gets reminders 7 days and 1 day before at 9 am local,
an appointment (anything with a `due_time`) gets one, the day before. Both the
review screen and this handler call `planReminders()`, **and both pass the same
`today`**, so a bill photographed three days before it is due shows one
reminder on the card and creates one row. Passing the day is what makes them
the same answer; sharing the function alone would not. The card's wording comes
from `PLAN_LINES` in that same file for the same reason.

Default decisions, open to review:

- **An unreadable field does not block confirming.** The person may supply a
  value, but an empty unreadable field stays empty and the task is created
  anyway. Blocking would trap the person on a form they cannot complete, which
  is a worse failure for this audience than a missing reference number.
- **The task's title is `` `${action_required} (${issuer})` ``**, mechanical
  and predictable. The prototype's hand-written titles ("Pay AGL electricity
  bill") cannot be derived from the six fields; a nicer rule is a product
  conversation, not an implementation detail. Because the rule above lets both
  halves be empty, and `tasks.title` is NOT NULL, it falls back in order:
  `action_required (issuer)`, then `action_required`, then
  `Letter from ${issuer}`, then `documentType`, then `Letter`. Nobody should
  ever meet a task called `()`.
- **A letter that names no date becomes a task with no due date**, no
  reminders, and no calendar mark. `planReminders()` is not called at all: it
  takes a date and throws without one. The plan card says so in place of the
  reminder rows, rather than showing an empty card under the heading "What
  DayKeeper will do".

**Pages that arrive later, for a letter she has already confirmed.** A person
who finds the fourth page of a form five minutes after uploading the first
three photographs it, and the reading places it against what she already has.
The letter is re-read whole, as a new attempt, and then four values decide what
happens next: `action_required`, `due_date`, `due_time`, `amount`. If any of
them changed, the document returns to `needs-review` and she is asked again. If
none did, it is updated and she is not told.

That comparison is code, not a judgement. Whether these pages belong to that
letter, and what the letter now says, are the reading's answers; whether that
changes what she has to do is `!=` on four values, which can be demonstrated
and tested rather than being a second thing to trust. `amount` is in the list
because paying the wrong number is a harm she carries, even though she is still
doing the same thing on the same day.

Which turns the review screen's promise into something stronger and checkable:

> **You will be asked whenever what you have to do changes, and never
> otherwise.**

That covers the silent update rather than leaving it outside the promise, and
it is the same rule that already batches the notification into one message
instead of one per letter. Every silent update is recorded, because it is the
only decision this system makes on her behalf that nothing else would surface.

## Read a failed document again

Re-reads the pages already on file, as a new attempt.

**URL** : `/api/documents/:id/retry`

**Method** : `POST`

**Auth required** : YES

**Data constraints** : empty body.

### Success Response

**Code** : `202 ACCEPTED`

**Content example**

```json
{ "id": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004", "status": "processing" }
```

### Error Responses

**Condition** : The document's status is not `failed`.
**Code** : `409 CONFLICT`

### Notes

A new `extraction_runs` row, no new `document_pages` rows.

Manual attempts do not spend `MAX_ATTEMPTS`, which bounds only the automatic
retries; a person who wants to try again gets to, and a button that silently
does nothing because a counter ran out is worse than one that fails again
visibly.

**There is no retake endpoint, on purpose.** A letter too blurry to read can
only be fixed by a new photograph, and a new photograph arrives the way every
photograph arrives: as an ordinary pile through `POST /api/documents`. A
dedicated "new photos for document X" channel would assume the person's next
photos are that letter, only that letter, and all of that letter, which is a
rule imposed on input whose defining property is that it obeys none; the
moment she catches anything else in the shot, a targeted channel attaches the
wrong pages to the wrong letter. If a re-photographed letter should be
reconnected to anything already here, recognising it is the matching step's
judgement, not a hard-wired link.

**Which control a failed row shows.** The kind decides the wording; the
follow-up is one thing everywhere: the row is put away, and where photographing
again could change the answer, the camera opens.

| kind | control | what happens |
|---|---|---|
| `unreadable_image` | **Take it again** | the row is put away and the camera opens; what she posts next is an ordinary pile |
| `transient` | **Try again** → `/retry` | the pages are fine and stay; the automatic attempts are spent, this spends a deliberate one |
| `unsupported_document` | **Put it away** | the row is put away; a better photograph would not help |

`FAILURE_MESSAGES` in the contract has the person-facing wording for all three.

## Put a document away

Archives it. Nothing is destroyed.

**URL** : `/api/documents/:id`

**Method** : `DELETE`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content** : the archived `DocumentSummary`, so the list can redraw the row it
already has rather than refetching. Default decision: nothing in the prototype
depends on the body, and the alternative, `204` with no content, is equally
defensible.

### Error Responses

**Condition** : No such document, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

It stays readable, and `confirmed_at` survives, so the record that a person
once checked this letter is not erased by putting it away. An archived document
leaves `inbox`, which is how a dead-end failure finally clears the queue.

Archiving a confirmed letter leaves its task, its reminders, its calendar dots
and its photograph exactly where they are. "Nothing is destroyed" would be an
odd promise to make while quietly removing things from someone's calendar.

## A page image

The photograph itself.

**URL** : `/api/documents/:id/pages/:page`

**Method** : `GET`

**Auth required** : YES

**Data constraints** : `:page` is the page number as the person counts it, from
1, within the current attempt.

### Success Response

**Code** : `302 FOUND`, `Location` being a time-limited link storage signed.

### Error Responses

**Condition** : No such page, or the document belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

This is where ownership is checked, and then the bytes go straight from the
bucket to the browser and never through the application. The check lives here
rather than in the link because a signed link expires but never asks who is
holding it. Pages travel in a payload as this path and not as a signed link, so
that nothing in a response goes stale while it sits in a cache.

`pageCount`, everywhere it appears, counts the current attempt only. Counting
every row in `document_pages` reports "4 pages" for a two-page letter that was
retaken once, and then offers two images that do not exist.

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

Dismissed tasks are excluded. Order is due date ascending, with dateless tasks
last.

**Uncapped, and it has to stay uncapped**, because the calendar is drawn from
it and a capped list draws a month whose dots stop partway through with no
error anywhere. Do not serve the calendar from `HomePayload.tasks`, which is
capped; the two would then disagree on screen, which is the exact failure
`GET /api/home` exists to prevent. A date-range parameter is the obvious answer
once an archive is large enough for this to hurt. **Open.**

`status` is `upcoming`, `overdue` or `completed`, computed from the due date at
read time rather than stored, **in the user's timezone**: something due today
is not overdue until today, where the person lives, is over. Use
`deriveTaskStatus()`; the UTC comparison it replaced kept a Melbourne task
"upcoming" until ten the next morning.

A task with no `dueDate` shows `No date` where the date goes. It draws no
calendar mark and has no reminders.

`dismissed` is set by nothing this semester. The state exists because a person
will eventually want a task off their list without ticking it off as done, and
adding an enum value later is not free; the filter here is what makes adding
the action later a one-line change. No endpoint produces it today.

Every summary carries its `reminders`, cancelled ones included with their
status saying so. This is what the calendar draws.

**Order.** The prototype puts a just-confirmed task at the top of the list,
above things due sooner, because its sketch appends to the front. Due date
ascending is the decision: a list about deadlines that is not ordered by
deadline is a list you have to read all of.

## One task, in full

The calendar day-sheet's endpoint: the task, the letter's fields, and enough to
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

Tapping an entry shows the letter's fields and offers the photograph, three
weeks after confirming.

`fields` follows the same rules as `GET /api/documents/:id`, with one
difference: the day sheet has no header, so `document_type` is simply omitted
rather than moved into one. Rows carrying `NO_PAYMENT_REQUIRED` or
`NOT_APPLICABLE` are hidden here too. This screen is read by someone checking
what a letter said, and a row reading "Amount: No payment required" is noise
for exactly the readers least able to absorb it.

## Tick a task off

Marks it done and calls off any reminder still waiting.

**URL** : `/api/tasks/:id/complete`

**Method** : `POST`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content** : `TaskSummary`, with `status: "completed"` and its remaining
reminders now `cancelled`.

### Error Responses

**Condition** : No such task, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

The cancellation happens in the same transaction: being nagged about something
already done is the anxiety this product exists to remove.

## Undo that

Puts a task back on the list.

**URL** : `/api/tasks/:id/complete`

**Method** : `DELETE`

**Auth required** : YES

### Success Response

**Code** : `200 OK`

**Content** : `TaskSummary`, open again.

### Notes

Ticking something off by accident should not need an apology.

Reminders cancelled by completing return to `scheduled`, **except those whose
`scheduledFor` has already passed**, which stay `cancelled`. Reviving a
reminder into the past would fire a nag about a deadline that has been and gone
the moment anything starts dispatching them.

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
  "counts": { "needsReview": 1, "processing": 2, "failed": 0 },
  "dividing": [
    {
      "id": "e2d41a90-77bc-4f0e-8a55-1cc4b9d33f21",
      "status": "grouping",
      "pageCount": 5,
      "uploadedAt": "2026-08-10T09:12:44+10:00",
      "documents": []
    }
  ],
  "inbox": [],
  "tasks": []
}
```

### Notes

- `counts`: `{ needsReview, processing, failed }`. The call to action is an
  ordered test, in this order: `needsReview > 0` says "N things need your OK",
  otherwise `processing > 0` **or a batch is still being divided** says
  "Reading your letters…", otherwise the panel goes inert and says "Nothing to
  check right now". `failed` does not enter it. Order matters and the obvious
  paraphrase gets it wrong: "a queue that is *all* still reading" would say
  "Nothing to check" while a letter is visibly being read in the card below it.
  The nav badge shows `needsReview` alone.
- `dividing`: batches that have been posted and not yet turned into letters,
  status `uploaded` or `grouping`, newest first. Each is one row saying how many
  photographs are in it, and it is replaced by its letters when the dividing
  finishes. Usually empty, and never for long.
- `inbox`: every document not yet dealt with, status `processing`,
  `needs-review` or `failed`, one merged list, newest upload first, not capped.
  The prototype renders these interleaved in a single card, so the server
  sends the one list they are rather than three lists the client must weave.
  The card is shown when `dividing` or `inbox` is non-empty, which is not the
  same test as the counts: a queue holding only failures still shows the card.
  The capture screen's "Posted just now" card is these same two lists.
- `tasks`: **open tasks due today or later, by due date ascending, plus
  anything completed in the last seven days**, capped at 20. The cap is a
  default decision; which twenty is not a free choice. Plain "the first twenty
  of `GET /api/tasks`" means the twenty earliest due dates the account has ever
  had, so after a few months a card headed "Coming up" is twenty struck-through
  rows from last March. The seven-day tail is why a row does not vanish from
  under the finger that just ticked it.

---

# The calendar

**There is no calendar endpoint, on purpose.**

The calendar is drawn from `GET /api/tasks`: a red dot (`--dot-due`) on each
task's `dueDate`, a gold dot (`--dot-rem`) on each reminder's `localDate`. Gold
appears in exactly two places in this product and this is one of them; see
`docs/theme.md`.

`ReminderView.localDate` is the server-computed calendar day in the user's zone
precisely so the client never turns an instant back into a day and gets it
wrong by one, and `localTime` is computed there with it so the day sheet's "a
reminder goes out this morning, 9 am" is data rather than copy.

**Every reminder that exists gets a dot, whatever its status**, including ones
already sent and ones cancelled when the task was ticked off. A dot is a record
of what this day held, not a forecast. The day sheet says which: the prototype's
present-tense sentence when the reminder is still `scheduled`, and a past or
cancelled wording otherwise, so that a completed task's day sheet does not
announce a reminder the system has already called off.

A reminder whose day has already gone by is never planned and never created, so
it has no dot. That is why the plan card and the calendar always agree: the
person is shown the reminders that will happen, agrees to those, and sees dots
for exactly those. Seeded data is the one exception, and deliberately so: it is
building a world that already happened, so it plants past reminders already
marked `sent`, and those do get dots. A dot for a reminder that has been sent is
correct. A dot for one that was never going to arrive would not be.

**The invariant that makes the calendar trustworthy: only confirmed documents
contribute.** A document in `processing`, `needs-review` or `failed` produces
no task, no reminder and no mark. Nothing reaches the calendar without a
person having seen it. This is the product's central safety promise, not an
implementation detail.

`archived` is not a fourth unconfirmed state: a letter that was confirmed and
later put away keeps its task and its marks, because a person confirmed it and
that has not stopped being true.

---

# Deliberately not specified

Not oversights. Each needs a decision nobody has made yet, and guessing now
would mean building the wrong thing twice.

**The largest is stated in full under `GET /api/documents/:id`, not repeated
here: whether the review screen shows the person the snippet each value was
read from.** Three documents in this repository say it does and the prototype
does not draw it, which makes it the one open question that touches what this
product claims to be for rather than how a screen behaves.

Six more belong to the capture screen and to failures, and they are listed
first because they are the ones a person meets soonest:

- **how one row becomes several.** A batch is one row while it is being
  divided, and then it is three letters. Whether the row splits in place, or
  fades and is replaced, or the letters slide in beneath it, is a piece of
  motion nobody has designed, and it is the first thing a person sees after
  they press the button
- **whether she is told that some photographs were not letters.** "I posted
  ten and got two letters" is a real confusion; but a photograph that is not
  a letter changes nothing she has to do, and the rule everywhere else is to
  spend her attention only on that. One line on the batch row would answer
  the confusion and cost a little noise; silence costs the confusion.
  Somebody has to pick
- **how the camera is actually held open.** The screen says "the camera stays
  open, keep going", and shots accumulate without leaving it. An
  `<input type="file" capture>` cannot do that: on both iOS and Android it
  closes the camera and returns to the page after every single shot. A live
  stream captured to blobs can. The caution about the `accept` attribute
  describes the fallback path, not this one, and somebody has to choose and
  then say so on the screen
- **which page was the bad one.** A five-page letter that fails says only "The
  photo was too blurry to read. Please take it again." Which one? A page
  number on the failure would let the message say "page three", and she would
  re-photograph one sheet instead of five. This is not the blur-check question
  below: it stays broken even once the blur check exists
- **what the capture screen does at the limits.** `MAX_PAGES` is 10 and
  `MAX_PAGE_BYTES` is 10 MB, and a current phone camera clears that per frame
  routinely. Whether the client downscales to fit or refuses the photograph,
  and what the screen says at page ten, is undecided. Refusing silently loses a
  photograph the person deliberately took, which is the failure the limits are
  exported to prevent
- **what an overdue task looks like.** `deriveTaskStatus()` returns `overdue`
  and no screen in the prototype draws it, while the prototype's own seed
  contains one. Red is the obvious guess and the wrong one: `--danger` already
  means a failed reading here, and colour is never the only signal in this
  product. Wording in the date column ("was due Wed 5 Aug") is the cheaper
  answer

And the rest:

- **password reset** needs an email sender, and no service has been chosen
- **the admin endpoints** need the operator's permissions settled first; the
  promise on screen is that letter content is never visible there, and the audit
  table is built so it cannot be
- **settings**: profile, notifications, password change, delete account, and
  exposing the timezone the schema already stores
- **rate limiting on sign-in**, before anything is public
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
