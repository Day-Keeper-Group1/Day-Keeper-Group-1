# API specification

**Every endpoint here is built.** This document was written before any of them,
because the interface, the reader and the database were going to be built by
different people, and the only way that ends in something that fits together is
to settle the seams before the parts. It stays the specification: a change to an
endpoint changes this file first.

To call the endpoints from a browser, run `npm run dev` and open `/api-docs`.
Sign in there with `POST /api/auth/login` and every other call carries the
session. That page is described in `src/server/api/openapi.ts`, and
`tests/openapi.test.ts` fails when a route handler is missing from it.

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
or the sessions table. To call a protected endpoint from curl or Postman, sign
in through `POST /api/auth/login` and send the `dk_session` cookie it sets.

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
| Create an account | `POST /api/auth/register` |
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

A person can now create their own account. The seed still plants Margaret, an
operator account and one empty account per teammate, so a checkout has somebody
to sign in as before anyone has registered.

---

# Signing in

## Create an account

Creates a person, and signs them in in the same breath.

**URL** : `/api/auth/register`

**Method** : `POST`

**Auth required** : NO

**Data constraints**

| field | rule |
|---|---|
| `email` | present, looks like an address, not already registered |
| `password` | at least 8 characters, at most 200 |
| `displayName` | present, not only whitespace |

**Data example**

```json
{
  "email": "margaret@example.com",
  "password": "the pot plant by the door",
  "displayName": "Margaret Whitfield"
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

The same `SessionUser` sign-in returns, so a client can treat the two the same.

### Error Responses

**Condition** : A field is missing, or fails the rule beside it above.
**Code** : `400 BAD REQUEST`

**Content example**

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Please check the details below.",
    "fields": { "password": "Please use at least 8 characters." }
  }
}
```

**Condition** : That address already has an account.
**Code** : `409 CONFLICT`

**Content example**

```json
{
  "error": {
    "code": "conflict",
    "message": "There is already an account with that email address."
  }
}
```

### Notes

**Why this was not in the original thirteen.** The first release signed people
in and left accounts to the seed, because the demonstration only needed somebody
to be Margaret. A deployment anybody can reach needs a front door, so this is
that door. Nothing else about the release changed.

**The password rule is length, and nothing else.** Eight characters to two
hundred, no required digit, no required symbol.
`validatePasswordStrength` in `src/server/auth/password.ts` is the only opinion,
and it explains itself: character-class rules push people towards `Passw0rd!`
and towards a note beside the computer, which for this reader is the worse
outcome. A long plain phrase is what we want and what the rule allows.

**The timezone is not asked for.** `users.timezone` defaults to
`Australia/Melbourne` in `db/schema.sql`, and registration lets the default
stand. It is a value she cannot be expected to know she has, and a settings
screen can expose it later.

**Uniqueness is the index's answer, not a query's.** The insert runs and a
`23505` becomes the `409` above. Asking first and inserting second reads more
naturally and is wrong: two registrations racing on the same address both pass
the check and one of them then fails anyway, in a place nobody wrote a message
for.

**This endpoint can be used to find out whether an address has an account, and
sign-in deliberately cannot.** The two answers are inconsistent on purpose.
Sign-in gives one sentence for a wrong address and a wrong password, so it says
nothing about who is registered. Registration has to say the address is taken,
because a person who already has an account needs to be told to sign in
instead. Every product with a front door makes this trade; the mitigations are
rate limiting on both endpoints, which is an open item, and never confirming an
address anywhere else.

**She is signed in on success**, rather than being returned to the sign-in
screen to type the same password again. The account and its audit entry are
written in one transaction; the session is opened immediately after it commits,
through the same `createSession` every other caller uses. Were that last step
ever to fail, the account would exist and she would sign in normally, which is
a better failure than a second copy of session-making living in this file.

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

## Ask to upload a letter

Names a letter and hands out one upload link per page, so the photographs can
go from the phone straight into storage. (KAN-75)

**URL** : `/api/documents/uploads`

**Method** : `POST`

**Auth required** : YES

**Why it exists.** A host that runs this app as functions refuses a request
much over 4 MB (Netlify, where the trial deployment runs, and Vercel alike), and
a letter of a few phone photographs is more than that. So the capture screen
does not send the photographs to the app. It sends them to the bucket, which
has no such limit, and tells the app afterwards. Three requests:

1. `POST /api/documents/uploads` with what is about to be sent;
2. `PUT` each photograph to its link, with the `Content-Type` the link was
   signed for;
3. [`POST /api/documents`](#upload-a-letter) with the letter's id, as JSON.

**Data constraints**

```json
{ "pages": [{ "contentType": "image/jpeg", "byteSize": 842251 }] }
```

One entry per photograph, in page order. The same rules as an upload through the
app: at least one, at most `MAX_PAGES`, images only, each within
`MAX_PAGE_BYTES`. The sizes are checked again in step 3 against what actually
landed, because what a browser says it will send is not a promise.

### Success Response

**Code** : `200 OK`

```json
{
  "documentId": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
  "pages": [
    {
      "pageNumber": 1,
      "uploadUrl": "https://…/daykeeper/uploads/…/1.jpg?X-Amz-Signature=…",
      "contentType": "image/jpeg"
    }
  ]
}
```

Each link is good for five minutes (`UPLOAD_URL_TTL_SECONDS` in
`src/server/storage.ts`) and lets its holder write exactly one object: the key
is derived from the signed-in person, the letter id and the page number, never
taken from the request.

### Error Responses

The same `400` bodies as [Upload a letter](#upload-a-letter) for a letter that
breaks a rule, and `401` when nobody is signed in.

### Notes

**Nothing is written here.** The id names objects that do not exist yet. The
letter becomes a row in step 3. A capture screen that asks and never finishes
leaves nothing, or leaves photographs no row points at; nothing sweeps those
yet, the same as a failed clean-up after an ordinary upload.

**The bucket has to accept a PUT from the page's origin.** Supabase Storage
allows any origin, and so does the MinIO in `docker-compose.yml` out of the
box; both were checked with a real signed PUT on 26 September 2026. A bucket
set up elsewhere needs a CORS rule allowing `PUT` with a `Content-Type` header.

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

**The other body: photographs already in the bucket.** With
`Content-Type: application/json` the body names photographs that the capture
screen has already put in storage, through the links from
[Ask to upload a letter](#ask-to-upload-a-letter):

```json
{
  "documentId": "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004",
  "pages": [{ "contentType": "image/jpeg" }, { "contentType": "image/jpeg" }]
}
```

The server derives each key again from the signed-in person and the id, so a
request can only ever point at its own sender's photographs. It reads the first
twelve bytes of each object, and refuses the letter with `400` if a page is
missing (`"Page 2 is missing."`), empty, over `MAX_PAGE_BYTES`, or not the kind
of image it was declared as, or if the id already has a letter (`"These photos
have already been sent."`). A refused letter's photographs are removed from the
bucket, except in that last case, where they belong to the letter already sent.
The answer on success is the same `201` as above; the whole photographs are
fetched for the reader after it has gone.

### Notes

**The response carries no reading, because at the moment the files are stored
nothing has looked at them.** The handler answers as soon as the photographs are
in the bucket and the rows are written; the reading happens after, and
the letter sits at `processing` until it comes back.

Validate on the server, not only in the file input: the `accept` attribute is a
hint to the person choosing a file, not a constraint on what arrives.

**Polling is one request.** While anything of this person's is still being read,
the interface polls `GET /api/home` every five seconds and stops when
`counts.processing` reaches zero. The count and the row come out of the same
payload, so one poll refreshes both, and neither can show a different answer
from the other. It is one poll for the whole app, not one per screen
(`src/components/layout/activity.tsx`): Home, the camera screen, the number on
the Home tab and the message that says a letter is ready all read it.

**How a letter is read.** The scheme is the newest entry in [`docs/extraction.md`](extraction.md): `gpt-5.6-luna` at `medium` reads the letter twice; if the two readings differ on a field, `gpt-5.6-terra` at `low` reads it once and the reading it matches is taken; if it matches neither, the letter is read again from the start, up to five rounds. Each round is a row in `extraction_runs`, and every model call under it, every attempt included, is a row in `model_calls`, so the tables say how many calls a letter took, with which model, and what each one said.

**Everything that can happen while a letter is read.** None of these is an HTTP error. The upload has already answered `201`, and the screen learns the outcome from the letter's `status` the next time it polls `GET /api/home`, which answers `200` whatever the outcome. The reason a reading failed is written to `failure_detail` on its run and never leaves the server.

| What happens | What the server does | Letter's status | What the screen shows |
|---|---|---|---|
| A model call fails: timeout, rate limit, network, an Azure error | That call is made again, up to three attempts in all, two seconds apart | `processing` | the row says "reading…" |
| A model call answers with something that is not JSON | That call is made again, as above | `processing` | "reading…" |
| A model call answers JSON outside the contract, such as a missing field | That call is made again, as above | `processing` | "reading…" |
| A model call still fails on its third attempt | The whole letter fails at once; it does not go round the scheme again | `failed` | the red row with the failure sentence |
| The reader is not configured, or a page reached it without its bytes | Not tried again; the letter fails at once | `failed` | the red row with the failure sentence |
| The two luna readings agree on every field | That is the reading | `needs-review` | "ready to check" |
| They differ, and the terra reading matches one of them | The matched reading is taken | `needs-review` | "ready to check" |
| They differ, and the terra reading matches neither | The next round is queued, and the next `GET /api/home` poll reads it: the letter is read again from the start, up to five rounds | `processing` | "reading…" |
| The host stops the request reading a round (KAN-75: Netlify stops a request at 30 seconds, background work included) | Two minutes after the round started, the next poll closes it as a round that decided nothing (`RoundTimedOut`) and queues the next one, or fails the letter if it was the fifth | `processing` | "reading…" |
| The fifth round still matches neither | The letter fails | `failed` | the red row with the failure sentence |
| The decided reading's due date or amount is not `confirmed` | The letter fails; a date or amount left empty would read as "no date" or "nothing to pay" (`src/lib/contract/extraction.ts`) | `failed` | the red row with the failure sentence |
| The decided reading has another field not `confirmed` | That field is stored and not shown; the rest of the reading stands | `needs-review` | "ready to check", without that row |
| The reading is decided but the database will not store it | Not tried again; the letter fails | `failed` | the red row with the failure sentence |
| The reading could not even be started in the database | Nothing is read; the letter fails | `failed` | the red row with the failure sentence |

The failure sentence is `FAILURE_MESSAGE` in `src/lib/contract/api.ts`, the same for every row: the person is not told which of these happened, because none of them is something she can do anything about. A failed letter stays failed. Repair is out of scope, so there is no retry endpoint and no retake endpoint. `readDocument()` in `src/server/uploads.ts` has the rules.

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
photographs that came with it. The Your letters screen draws the saved ones
(`confirmed` and `archived`): a letter still being read, waiting to be checked,
or failed is on Home under To check, where something can be done about it.

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
      "value": "Pay AGL Energy",
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
  "identifiers": [
    {
      "label": "NMI",
      "value": "6102 3345 781",
      "isReference": false
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

`identifiers` is every number the letter prints that identifies the person,
something she holds, or this matter, each under the label printed beside it
(`IdentifierView` in `src/lib/contract/api.ts`). Confident ones only, in the
order the reading gave, with the one whose value is the confident `reference`
first and marked `isReference`. In the example the reference could not be read,
so nothing is marked and the one number listed is the meter's. Empty whenever
`fields` is, and for a letter read before the list existed. The reading prompt
does not ask for the list yet, so a real reading returns it empty; the seed and
the mock reader fill it. A screen shows these
rows in place of the Reference row, and says "The one to quote" under the marked
one when there is more than one (`factLines()` in `src/lib/facts.ts`).

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
    "title": "Pay AGL Energy",
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

**A letter that asks for nothing** (`action_required` is `No action`) is saved
and makes no task, so `task` is null:

```json
{
  "documentId": "b71c0d54-8e33-4a77-8c19-90ab4e6f2213",
  "task": null
}
```

### Error Responses

**Condition** : The letter is not waiting to be checked: it has already been
confirmed, it is still being read, or its reading failed.
**Code** : `409 CONFLICT`

**Content example**

```json
{
  "error": {
    "code": "conflict",
    "message": "This letter is already saved."
  }
}
```

The other two say "This letter is still being read." and "This letter could not
be read, so there is nothing to save." It renders as a line above the button,
which stays where it is so she can see what happened. The `message` is written
to be shown as-is.

**Condition** : No such letter, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

The returned task includes its reminders, so the calendar the person lands on
can draw itself without a second request.

**After a save, the screen moves on by itself** (`src/lib/confirm-flow.ts`). A
note says what was kept and where, and goes after three seconds; she is taken
straight to the next letter waiting, first photographed first; and after the
last one she lands on the calendar at the month of the last task she saved, or
on Your letters if none of the letters she saved made a task. Which letter is
next is asked of `GET /api/home` after the save, so a reading that landed while
she was checking joins the end of the queue. "Not now" goes Home and ends the
run.

Confirming is the moment a letter becomes a task with reminders, all in one
transaction (`confirmDocument()` in `src/server/confirm.ts`), with a
`document.confirm` row in `audit_logs` carrying the task's id and how many
reminders were planned, never anything the letter said. The letter is locked
while it is read, so two taps on the button cannot make two tasks. The schedule comes from `planReminders()` and nowhere else. **The
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
- **The task's title is `action_required`, with the issuer in brackets only
  when the action does not already name it.** `action_required` starts with an
  action word and usually names who ("Pay AGL Energy"), so the bracket would
  repeat it; "Attend GP appointment (Dr A. Patel, GP clinic)" keeps it. Because
  either half can be empty and `tasks.title` is NOT NULL, it falls back to
  `action_required`, then `Letter from issuer`, then the document type, then
  `Letter`. The rule is one function, `taskTitle()` in
  `src/lib/contract/api.ts`, which the confirm handler must call.
- **A letter whose action is `No action` is kept as a letter and gets no
  task.** Nothing asks her to do anything, and a task titled "No action" on the
  home list would be the kind of noise this product exists to remove.
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
    "title": "Pay AGL Energy",
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
anywhere. Do not serve the calendar from `HomePayload.tasks`, which drops completed
tasks older than seven days: the two would then disagree on screen, which is the exact failure
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
`fields` and `identifiers` (as in `GET /api/documents/:id`) and `pageCount`.

### Error Responses

**Condition** : No such task, or it belongs to somebody else.
**Code** : `404 NOT FOUND`

### Notes

This is what makes "what said so?" answerable three weeks after confirming:
tapping an entry shows the letter's fields and offers the photograph.

`fields` and `identifiers` follow the same rules as `GET /api/documents/:id`.

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
  or `failed`, one merged list, first photographed first, not capped. The card is
  shown when `inbox` is non-empty, which is not the same test as the counts: a
  queue holding only failures still shows the card.
- `tasks`: **every open task, whatever its date, plus anything completed in the
  last seven days**, by due date ascending with dateless tasks last, not capped. Open tasks are never filtered by date: an unpaid bill from three weeks ago
  is the loudest thing this person owns, and the ascending sort already puts it
  first. (An earlier draft said "open tasks due today or later", which reads
  sensibly and quietly removes exactly that bill from the screen; the wording
  here is deliberate.) Completed rows are the only ones that age out: seven days
  from the tick, so a row does not vanish from under the finger that just ticked
  it, and a card headed "Coming up" does not become twenty struck-through rows
  from last March. There was a cap of 20, and it removed the furthest tasks with
  nothing on screen to say so. Home now shows overdue, today and the next seven
  days whole, the first three of the rest, and a link to the calendar naming how
  many more there are (`src/lib/home.ts`).

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

- **a real queue for readings.** The runner is decided for now (KAN-75): a
  reading runs one round per request. The upload reads the first round after
  it has answered; a round that decides nothing queues the next, and
  `GET /api/home`, which the screen polls every five seconds while anything is
  being read, reads it after answering (`continueReadings` in
  `src/server/uploads.ts`). The reason is the host: Netlify stops a request at
  30 seconds, background work included, and a round takes 10 to 25. Still
  open is anything that reads a letter nobody is watching: a letter whose
  person closes the app mid-reading waits, queued, until they open it again
- **sending reminders, the transport half.** What the dispatcher decides is
  settled, in `src/lib/contract/reminders.ts`. What is still open is what wakes
  it up: a cron job, a platform scheduler, or in-app only
- **what the capture screen says at the last page.** The size half is
  decided (KAN-75): the capture screen redraws any photograph over 1 MB so its
  long side is 3508 pixels, the size of the pages the reader was measured on,
  and sends one at or under 1 MB untouched. `src/lib/photos.ts` has the rule
  and the reasons. A host that runs this app as functions refuses a request
  much over 4 MB, which is why the line sits well under `MAX_PAGE_BYTES`
- **rate limiting on sign-in**, before anything is public

## Development only: try the reader

Three URLs exist while `NODE_ENV` is not `production`, and answer `404` when it is. None is part of the product API above.

`GET /api-docs` is a Swagger page for every endpoint in this document, and for this one, from the description at `GET /api/openapi.json`. `POST /api/dev/extract` takes one or more photographed pages of one letter as the multipart field `pages`, calls whichever reader `AI_EXTRACTION_PROVIDER` names, validates the answer against the extraction contract, and returns `{ call, result }`: `result` is the contract shape with `provider` and `model` stamped by the code rather than taken from the model, and `call` is the call's own record, which reader, which model, at which effort, how many seconds, and the tokens it consumed as the provider reported them. Nothing is stored and no sign-in is asked for. It is a way to look at one reading on its own; the product reads a letter through `POST /api/documents`. Sample letters are in `data/synthetic-letters/`.
