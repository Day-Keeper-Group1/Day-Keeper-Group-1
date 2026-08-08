# API specification

**None of this is built yet. This is the shape to build.**

It is written down first because the interface, the reader and the database were
being designed by different people at the same time, and the only way that ends
in something that fits together is to settle the seams before the parts.

Every endpoint answers JSON except the one that serves an image.

The types are already in `src/lib/contract/api.ts`: `DocumentSummary`,
`DocumentDetail`, `TaskSummary`, `ExtractedFieldView`, `SessionUser`, `ApiError`.
**Import them rather than restating them.** They match what the interface pages
were already written against, so a handler that returns one of these needs no
translation on the way to the screen.

This specification was written after building the whole thing once as a spike
and throwing it away. That is why the awkward parts are specified rather than
left open: they are the places where the first attempt went wrong.

## How to talk to it

Authentication is a `dk_session` cookie, set by sign-in and sent automatically
by the browser. Everything except the auth endpoints answers `401` without it.

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

### `POST /api/documents`
`multipart/form-data`, one or more files under **`pages`**, in the order they
were photographed. → `201 { id, status: "processing" }`.

Images and PDF, up to 10 MB each, at most 10 pages. Returns as soon as the files
are stored; the reading happens afterwards. The interface polls
`GET /api/documents/:id` until `status` is no longer `processing`.

Validate on the server, not only in the file input: the `accept` attribute is a
hint to the person choosing a file, not a constraint on what arrives.

### `GET /api/documents/:id`
→ `DocumentDetail`: the summary, plus `fields`, plus `pages`, plus `failure`
when it failed.

`fields` come from the most recent successful reading, in reading order, with a
person's correction taking precedence over what the model said. Each carries
`rawText`: the snippet on the page the value came from. **Show it.** It is what
lets a person check the reading instead of merely accepting it.

### `POST /api/documents/:id/confirm`
`{ fields: [{ key, value }] }` → `200 { documentId, taskId }`.

Send **only the fields the person changed**. The rest are already right, and
recording a correction against them would corrupt the numbers we use to measure
how often the reader is wrong.

This is the moment a document becomes a task with reminders, all in one
transaction. Confirming twice answers `409`.

### `POST /api/documents/:id/retake`
`multipart/form-data`, same shape as upload. Replaces every page and reads it
again. The document keeps its id, and previous attempts stay in the history.
This is the way out of a failed reading.

### `DELETE /api/documents/:id`
Archives it. Nothing is destroyed; it stays readable.

### `GET /api/documents/:id/pages/:page`
The image itself. Ownership is checked here because local storage cannot sign
URLs. Answers `404` for someone else's page.

## Tasks

### `GET /api/tasks`
→ `TaskSummary[]`, excluding dismissed ones, by due date.

`status` is `upcoming`, `overdue` or `completed`, computed from the due date at
read time rather than stored. Something due today is not overdue until today is
over.

### `POST /api/tasks/:id/complete`
→ `200 TaskSummary`. Cancels any reminders still waiting, in the same
transaction: being nagged about something already done is the anxiety this
product exists to remove.

### `DELETE /api/tasks/:id/complete`
Undo. Ticking something off by accident should not need an apology.

## The home screen

### `GET /api/home`
Everything that screen shows, in one request: `counts`, `needsReview`,
`processing`, `recentDocuments`, `tasks`. One request rather than three so the
counts and the lists cannot disagree with each other on screen.

## Deliberately not specified

Not oversights. Each needs a decision nobody has made yet, and guessing now
would mean building the wrong thing twice:

- **password reset** needs an email sender, and no service has been chosen
- **the admin endpoints** need the operator's permissions settled first; the
  promise on screen is that letter content is never visible there, and the audit
  table is built so it cannot be
- **settings**: profile, notifications, password change, delete account
- **rate limiting on sign-in**, before anything is public
- **object storage**, and therefore signed URLs. The tech-stack note proposes
  the layout `documents/{user_id}/{document_id}/page-{n}.{ext}`
- **sending reminders.** They are rows with a `scheduled_for`; nothing dispatches
  them yet, and what does is a real decision (a cron job, a platform scheduler,
  in-app only)
